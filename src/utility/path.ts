export function toPosixPath(p: string) {
  // Extended-Length Paths in Windows start with "\\?\" to allow longer paths and bypass usual parsing. If detected, we return the path unmodified to maintain functionality, as altering these paths could break their special syntax.
  const isExtendedLengthPath = p.startsWith("\\\\?\\");

  if (isExtendedLengthPath) {
    return p;
  }

  return p.replace(/\\/g, "/");
}
