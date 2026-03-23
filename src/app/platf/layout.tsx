import { PlatfProviders } from "@/platf/PlatfProviders";

export default function PlatfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PlatfProviders>{children}</PlatfProviders>;
}

