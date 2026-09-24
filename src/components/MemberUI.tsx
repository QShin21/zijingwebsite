import type { ReactNode } from "react";
import { BrandMark } from "./Identity";

export function MemberLayout({
  title,
  description,
  steps,
  children,
}: {
  title: string;
  description: string;
  steps: string[];
  children: ReactNode;
}) {
  return (
    <div className="auth-layout">
      <aside className="auth-intro">
        <BrandMark />
        <h2>{title}</h2>
        <p>{description}</p>
        <ol>
          {steps.map((step, index) => (
            <li key={step}>
              <span>0{index + 1}</span>
              <div>{step}</div>
            </li>
          ))}
        </ol>
      </aside>
      <section className="member-shell">{children}</section>
    </div>
  );
}

export function FormStep({ number, title }: { number: string; title: string }) {
  return (
    <h2 className="form-heading">
      <span>{number}</span>
      {title}
    </h2>
  );
}
