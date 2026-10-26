import { useTranslation } from "react-i18next";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

/** The cookie and browser-storage table of the Privacy Policy (`#cookies`); values match rule 04 and docs/23 section 5.1. */
export function LegalCookieTable() {
    const { t } = useTranslation("legal");
    const rows = t("cookies.rows", { returnObjects: true });

    return (
        <Table>
            <TableCaption className="sr-only">
                {t("cookies.caption")}
            </TableCaption>
            <TableHeader>
                <TableRow>
                    <TableHead>{t("cookies.columns.name")}</TableHead>
                    <TableHead>{t("cookies.columns.type")}</TableHead>
                    <TableHead>{t("cookies.columns.purpose")}</TableHead>
                    <TableHead>{t("cookies.columns.lifetime")}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.isArray(rows)
                    ? rows.map((row) => (
                          <TableRow key={row.name}>
                              <TableCell className="type-code align-top">
                                  {row.name}
                              </TableCell>
                              <TableCell className="whitespace-normal align-top">
                                  {row.type}
                              </TableCell>
                              <TableCell className="whitespace-normal align-top">
                                  {row.purpose}
                              </TableCell>
                              <TableCell className="whitespace-normal align-top">
                                  {row.lifetime}
                              </TableCell>
                          </TableRow>
                      ))
                    : null}
            </TableBody>
        </Table>
    );
}
