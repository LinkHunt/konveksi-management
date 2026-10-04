type TableProps = {
  children?: React.ReactNode;
  title?: string;
};

export function Table({ children, title }: TableProps) {
  return (
    <div>
      {title ? <h3>{title}</h3> : null}
      <table>{children}</table>
    </div>
  );
}
