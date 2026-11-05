import { SUPPORT_EMAIL } from "@/frontend/shared/lib/site";
import { Breadcrumb, PageContainer, SiteShell } from "@/frontend/shared/ui/site/site-shell";
import { Card, PageTitle, SectionHeading } from "@/frontend/shared/ui/surface";
import { Tag } from "@/frontend/shared/ui/tag";
import { LEGAL_META, type LegalCopy } from "../lib/legal-copy";

/** Long-form legal page: version tags, a sticky "On this page" list, numbered sections. */
export function LegalDocument({ copy }: { copy: LegalCopy }) {
  const sections = copy.sections.map((s, i) => ({ ...s, id: `section-${i + 1}`, number: i + 1 }));

  return (
    <SiteShell>
      <PageContainer>
        <Breadcrumb>Legal / {copy.title}</Breadcrumb>
        <PageTitle>{copy.title}</PageTitle>
        <div className="mt-2 flex flex-wrap gap-3">
          <Tag>Version {LEGAL_META.version}</Tag>
          <Tag>Effective {LEGAL_META.effective}</Tag>
        </div>
        {copy.lead && <p className="mt-3 max-w-[720px] text-p1 text-ink-muted">{copy.lead}</p>}

        <div className="mt-6 flex flex-wrap gap-12">
          <aside className="flex-[0_0_240px] self-start lg:sticky lg:top-4">
            <Card>
              <p className="eyebrow">On this page</p>
              <nav aria-label="On this page" className="mt-1.5 flex flex-col">
                {sections.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="py-1 text-p2 no-underline hover:underline">
                    {s.number}. {s.title}
                  </a>
                ))}
              </nav>
            </Card>
          </aside>

          <div className="max-w-[720px] flex-[1_1_560px]">
            {sections.map((s, i) => (
              <section key={s.id} aria-labelledby={s.id} className={i === 0 ? "" : "mt-7"}>
                <SectionHeading id={s.id} className="scroll-mt-4">
                  {s.number}. {s.title}
                </SectionHeading>
                <p className="mt-1 text-p1">{s.body}</p>
              </section>
            ))}
            {copy.questions && (
              <p className="mt-8 text-p2 text-ink-muted">
                Questions?{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-ink underline">
                  {SUPPORT_EMAIL}
                </a>
              </p>
            )}
          </div>
        </div>
      </PageContainer>
    </SiteShell>
  );
}
