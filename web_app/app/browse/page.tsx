import { BrowseClient } from "@/components/browse/browse-client";

export const metadata = {
  title: "Odkrywaj – SubsControl",
  description: "Szukaj filmów i seriali. Sprawdź na jakim serwisie możesz je obejrzeć ze swoimi subskrypcjami.",
};

export default function BrowsePage() {
  return <BrowseClient />;
}
