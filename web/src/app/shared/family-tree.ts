import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Family, FamilyPerson } from '../core/models';
import { Spoilers } from '../core/spoilers';

export interface TreeGroup {
  coParent: FamilyPerson | null;
  label: string;
  children: TreeNode[];
}
export interface TreeNode {
  person: FamilyPerson;
  spouses: FamilyPerson[];
  groups: TreeGroup[];
}

/**
 * Turns a flat family list into trees. Children are grouped by their other parent, so a child
 * born outside the marriage (e.g. Глория, daughter of Галлард and Сибил) is never shown as the
 * child of the spouse. Disconnected branches become separate trees.
 */
export function buildForest(f: Family): { roots: TreeNode[]; rest: FamilyPerson[] } {
  const people = f.people;
  const byId = new Map(people.map((p) => [p.id, p]));
  const placed = new Set<string>();
  const spouseOf = (p: FamilyPerson) =>
    [
      ...new Set([
        ...(p.spouses ?? []),
        ...people.filter((q) => q.spouses?.includes(p.id)).map((q) => q.id),
      ]),
    ]
      .map((id) => byId.get(id))
      .filter((x): x is FamilyPerson => !!x);

  const build = (p: FamilyPerson, depth: number): TreeNode => {
    placed.add(p.id);
    const spouses = spouseOf(p).filter(
      (s) => !placed.has(s.id) || (s.parents ?? []).every((x) => !byId.has(x)),
    );
    spouses.forEach((s) => placed.add(s.id));
    const unit = new Set([p.id, ...spouses.map((s) => s.id)]);
    const kids = people.filter(
      (c) => !placed.has(c.id) && (c.parents ?? []).some((x) => unit.has(x)),
    );
    const groups = new Map<string, FamilyPerson[]>();
    for (const c of kids) {
      const other = (c.parents ?? []).find((x) => x !== p.id && byId.has(x)) ?? '';
      const key = (c.parents ?? []).includes(p.id)
        ? other
        : ((c.parents ?? []).find((x) => unit.has(x)) ?? '');
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    const out: TreeGroup[] = [];
    for (const [key, cs] of groups) {
      const co = byId.get(key) ?? null;
      if (co && !unit.has(co.id)) placed.add(co.id);
      const onlySpouseGroup = groups.size === 1 && spouses.length === 1 && co?.id === spouses[0].id;
      const label =
        onlySpouseGroup || (!co && !spouses.length)
          ? ''
          : co
            ? `от ${short(co.name)}`
            : 'второй родитель не назван';
      const children =
        depth > 12 ? [] : cs.filter((c) => !placed.has(c.id)).map((c) => build(c, depth + 1));
      out.push({ coParent: co, label, children });
    }
    return { person: p, spouses, groups: out };
  };

  const hasParentHere = (p: FamilyPerson) => (p.parents ?? []).some((x) => byId.has(x));
  const roots: TreeNode[] = [];
  // Roots: people without parents in this house who are not merely the spouse of someone with parents.
  const candidates = people.filter((p) => !hasParentHere(p) && !spouseOf(p).some(hasParentHere));
  candidates.sort((a, b) => descendants(b, people) - descendants(a, people));
  for (const r of candidates)
    if (!placed.has(r.id) && (descendants(r, people) > 0 || spouseOf(r).length))
      roots.push(build(r, 0));
  for (const p of people) if (!placed.has(p.id) && hasParentHere(p)) roots.push(build(p, 0));
  const rest = people.filter((p) => !placed.has(p.id));
  return { roots, rest };
}

function descendants(p: FamilyPerson, people: FamilyPerson[]): number {
  const seen = new Set<string>();
  const walk = (id: string) =>
    people
      .filter((c) => c.parents?.includes(id))
      .forEach((c) => {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          walk(c.id);
        }
      });
  walk(p.id);
  return seen.size;
}

const short = (name: string) => name.split(' ')[0];

@Component({
  selector: 'app-family-node',
  imports: [RouterLink],
  template: `
    @let n = node();
    <div class="unit">
      @for (p of [n.person].concat(n.spouses); track p.id; let first = $first) {
        @if (!first) {
          <span class="amp" title="брак">⚭</span>
        }
        <span class="p" [class.noart]="!p.slug">
          @if (p.slug) {
            <a [routerLink]="'/' + p.slug">{{ p.name }}</a>
          } @else {
            {{ p.name }}
          }
          @if (p.note) {
            <small
              [innerHTML]="p.note"
              [class.spoil-blur]="blurNotes()"
              (click)="$any($event.currentTarget).classList.remove('spoil-blur')"
            ></small>
          }
        </span>
      }
    </div>
    @if (n.groups.length) {
      <ul>
        @for (g of n.groups; track $index) {
          @for (c of g.children; track c.person.id; let first = $first) {
            <li>
              @if (g.label && first) {
                <span class="from">{{ g.label }}</span>
              }
              <app-family-node [node]="c" [blurNotes]="blurNotes()" />
            </li>
          }
        }
      </ul>
    }
  `,
  styleUrl: './family-tree.css',
})
export class FamilyNode {
  readonly node = input.required<TreeNode>();
  readonly blurNotes = input(false);
}

@Component({
  selector: 'app-family-tree',
  imports: [FamilyNode, RouterLink],
  template: `
    @let f = forest();
    @for (r of f.roots; track r.person.id; let i = $index) {
      <section class="branch">
        @if (f.roots.length > 1) {
          <div class="branch-title">
            {{ i === 0 ? 'Основная линия' : 'Ветвь: ' + r.person.name }}
          </div>
        }
        <div
          class="tree"
          tabindex="0"
          aria-label="Родословное древо, доступна горизонтальная прокрутка"
        >
          <ul>
            <li><app-family-node [node]="r" [blurNotes]="blur()" /></li>
          </ul>
        </div>
      </section>
    }
    @if (f.rest.length) {
      <p class="rest ui">
        Также в роду:
        @for (p of f.rest; track p.id; let last = $last) {
          @if (p.slug) {
            <a [routerLink]="'/' + p.slug">{{ p.name }}</a>
          } @else {
            {{ p.name }}
          }
          @if (!last) {
            ,
          }
        }
      </p>
    }
  `,
  styleUrl: './family-tree.css',
})
export class FamilyTree {
  readonly family = input.required<Family>();
  private readonly spoilers = inject(Spoilers);
  protected readonly forest = computed(() => buildForest(this.family()));
  protected readonly blur = computed(() => this.spoilers.active() && this.spoilers.level() < 18);
}
