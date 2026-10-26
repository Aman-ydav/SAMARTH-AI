import { useTranslation } from "react-i18next";
import { Reveal } from "@/components/motion/Reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AboutSectionShell } from "@/features/marketing/components/AboutSectionShell";

const STAGGER_SECONDS = 0.06;

/** The six principles as cards, revealed once on view (ANIM-51 "values"). */
export function AboutPrinciplesSection() {
    const { t } = useTranslation("about");
    const items = t("principles.items", { returnObjects: true });

    return (
        <AboutSectionShell title={t("principles.title")}>
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.isArray(items)
                    ? items.map((item, index) => (
                          <Reveal
                              as="li"
                              key={item.title}
                              delay={index * STAGGER_SECONDS}
                          >
                              <Card className="h-full">
                                  <CardHeader>
                                      <CardTitle>
                                          <h3 className="type-h3">
                                              {item.title}
                                          </h3>
                                      </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                      <p className="type-body text-muted-foreground">
                                          {item.body}
                                      </p>
                                  </CardContent>
                              </Card>
                          </Reveal>
                      ))
                    : null}
            </ul>
        </AboutSectionShell>
    );
}
