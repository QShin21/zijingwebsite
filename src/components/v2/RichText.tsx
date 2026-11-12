import type { ReactNode } from "react";
import { RichText as LexicalRichText } from "@payloadcms/richtext-lexical/react";
import { safeURL } from "@/lib/rules";
import styles from "./prose.module.css";

type Data = Parameters<typeof LexicalRichText>[0]["data"];

/** Reading typography for CMS rich text (already sanitised by the V2 projection). */
export function RichText({ body, text, children }: { body?: unknown; text?: string | null; children?: ReactNode }) {
  if (!body && !text && !children) return null;
  return (
    <div className={styles.prose}>
      {body ? (
        <LexicalRichText
          data={body as Data}
          converters={({ defaultConverters }) => ({
            ...defaultConverters,
            link: ({ node, nodesToJSX }) => {
              const href = node.fields?.url;
              return safeURL(href) ? (
                <a href={href} rel="noopener noreferrer">
                  {nodesToJSX({ nodes: node.children })}
                </a>
              ) : (
                <span>{nodesToJSX({ nodes: node.children })}</span>
              );
            },
          })}
        />
      ) : text ? (
        <p className={styles.plain}>{text}</p>
      ) : null}
      {children}
    </div>
  );
}

export function Sections({ sections }: { sections: { id: string; heading: string; text: string }[] }) {
  if (!sections.length) return null;
  return (
    <div className={styles.prose}>
      {sections.map((section) => (
        <section key={section.id} id={`section-${section.id}`}>
          <h2>{section.heading}</h2>
          <p className={styles.plain}>{section.text}</p>
        </section>
      ))}
    </div>
  );
}
