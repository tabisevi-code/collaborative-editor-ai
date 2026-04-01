type StatusTone = "info" | "success" | "warning" | "error";

interface StatusBannerProps {
  tone: StatusTone;
  title: string;
  message: string;
}

/**
 * A single banner component keeps request feedback visually consistent across
 * create, open, and document pages.
 */
export function StatusBanner({ tone, title, message }: StatusBannerProps) {
  return (
    <section className={`status-banner status-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <strong>{title}</strong>
      <p>{message}</p>
    </section>
  );
}
