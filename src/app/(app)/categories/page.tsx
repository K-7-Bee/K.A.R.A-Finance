import type { Metadata } from "next";
import { AddCategoryForm, ArchivedCategoryRow, CategoryRow } from "@/components/categories/category-forms";
import { cardClass } from "@/components/ui/styles";
import { listCategories } from "@/lib/data/categories";
import { getPersonalWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Categories · KARA Finance" };

const SECTIONS = [
  { kind: "income", title: "Income" },
  { kind: "expense", title: "Expense" },
] as const;

export default async function CategoriesPage() {
  const { workspace } = await getPersonalWorkspace();
  const categories = await listCategories(workspace.id);
  const archived = categories.filter((c) => c.isArchived);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-midnight">Categories</h1>
        <p className="text-sm text-midnight/80">Archived categories stay on past transactions but can&apos;t be picked for new ones.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {SECTIONS.map(({ kind, title }) => {
          const active = categories.filter((c) => c.kind === kind && !c.isArchived);
          const headingId = `heading-${kind}`;
          return (
            <section key={kind} aria-labelledby={headingId} className={`${cardClass} space-y-3`}>
              <h2 id={headingId} className="font-semibold text-midnight">{title}</h2>
              <AddCategoryForm kind={kind} />
              {active.length === 0 ? (
                <p className="text-sm text-midnight/80">No {kind} categories yet.</p>
              ) : (
                <ul className="divide-y divide-midnight/10">
                  {active.map((c) => <CategoryRow key={`${c.id}-${c.name}`} id={c.id} name={c.name} />)}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {archived.length > 0 && (
        <section aria-labelledby="heading-archived" className={`${cardClass} space-y-2`}>
          <h2 id="heading-archived" className="font-semibold text-midnight">Archived</h2>
          <ul className="divide-y divide-midnight/10">
            {archived.map((c) => <ArchivedCategoryRow key={c.id} id={c.id} name={c.name} kind={c.kind} />)}
          </ul>
        </section>
      )}
    </section>
  );
}
