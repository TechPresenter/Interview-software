/** Small ownership/credit line shown under the auth cards. */
export function AuthCredit() {
  return (
    <p className="mt-6 text-center text-xs text-muted-foreground">
      Powered by <span className="font-medium text-foreground/80">NIIPL Group</span>
      <span className="mx-1.5 text-muted-foreground/50">|</span>
      Developed by{' '}
      <a
        href="https://appsgain.in"
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-foreground/80 transition-colors hover:text-primary hover:underline"
      >
        Appsgain Technologies
      </a>
    </p>
  );
}

export default AuthCredit;
