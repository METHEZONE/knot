/**
 * Amount wrapper for public replays: when masked, the value is blurred and
 * unselectable (the toggle in the theater reveals it).
 */
export function MaskedAmount({
  masked,
  children,
}: {
  masked: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden={masked || undefined}
      className={
        masked
          ? "select-none rounded blur-[6px] transition-[filter] duration-300"
          : "transition-[filter] duration-300"
      }
    >
      {children}
    </span>
  );
}
