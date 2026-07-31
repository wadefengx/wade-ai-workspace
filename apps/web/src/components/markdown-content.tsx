"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { Button, Typography } from "antd";
import { encode } from "plantuml-encoder";
import { useEffect, useId, useMemo, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import shellStyles from "./workspace-shell.module.css";

type MarkdownContentProps = {
  content: string;
};

type MarkdownCodeProps = ComponentPropsWithoutRef<"code"> & {
  inline?: boolean;
};

type MermaidModule = {
  default: {
    initialize: (config: { startOnLoad: boolean; theme: "default" | "dark" }) => void;
    render: (id: string, text: string) => Promise<{ svg: string }>;
  };
};

function resolveCodeText(children: ComponentPropsWithoutRef<"code">["children"]) {
  return Array.isArray(children) ? children.join("") : String(children ?? "");
}

function InlineCode({ children }: ComponentPropsWithoutRef<"code">) {
  return <code className={shellStyles.markdownInlineCode}>{children}</code>;
}

function CodeBlock({ language, code }: { language?: string; code: string }) {
  if (language === "mermaid") {
    return <MermaidBlock code={code} />;
  }

  if (language === "plantuml" || language === "c4") {
    return <PlantUmlBlock code={code} />;
  }

  return (
    <pre className={shellStyles.markdownCodeBlock}>
      <code>{code}</code>
    </pre>
  );
}

function MermaidBlock({ code }: { code: string }) {
  const mermaidId = useId().replace(/:/g, "-");
  const [theme, setTheme] = useState<"default" | "dark">("default");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [svg, setSvg] = useState("");

  useEffect(() => {
    const syncTheme = () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "default");
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      setStatus("loading");

      try {
        const mermaid = ((await import("mermaid")) as MermaidModule).default;
        mermaid.initialize({ startOnLoad: false, theme });
        const result = await mermaid.render(`mermaid-${mermaidId}`, code);

        if (cancelled) {
          return;
        }

        setSvg(result.svg);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setSvg("");
          setStatus("error");
        }
      }
    };

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, mermaidId, theme]);

  if (status === "error") {
    return (
      <pre className={shellStyles.markdownCodeBlock}>
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div className={shellStyles.markdownDiagram}>
      {status === "loading" ? (
        <div className={shellStyles.markdownDiagramCard}>
          <Typography.Text type="secondary">
            <LoadingOutlined spin /> 正在渲染 Mermaid 图表…
          </Typography.Text>
        </div>
      ) : null}
      {status === "ready" ? (
        <div
          className={`${shellStyles.markdownDiagramCard} ${shellStyles.markdownDiagramSvg}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
    </div>
  );
}

function PlantUmlBlock({ code }: { code: string }) {
  const plantUmlUrl = useMemo(() => `https://www.plantuml.com/plantuml/svg/${encode(code)}`, [code]);

  return (
    <div className={shellStyles.markdownDiagram}>
      <div className={shellStyles.markdownDiagramCard}>
        <div className={shellStyles.markdownDiagramActions}>
          <Button href={plantUmlUrl} target="_blank" rel="noreferrer" type="link">
            在 PlantUML 服务器打开 ↗
          </Button>
          <Typography.Text type="secondary">当前版本提供外链预览，原始源码仍可展开查看。</Typography.Text>
        </div>
        <details className={shellStyles.markdownDiagramDetails}>
          <summary className={shellStyles.markdownDiagramSummary}>查看原文</summary>
          <pre className={`${shellStyles.markdownCodeBlock} ${shellStyles.markdownDiagramSource}`}>
            <code>{code}</code>
          </pre>
        </details>
      </div>
    </div>
  );
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const components = useMemo<Components>(
    () => ({
      pre: ({ children }) => <>{children}</>,
      code: ({ className, children, inline, ...props }: MarkdownCodeProps) => {
        const language = /language-([\w-]+)/.exec(className ?? "")?.[1]?.toLowerCase();

        if (inline) {
          return <InlineCode {...props}>{children}</InlineCode>;
        }

        return <CodeBlock language={language} code={resolveCodeText(children).replace(/\n$/, "")} />;
      }
    }),
    []
  );

  return (
    <div className={shellStyles.markdown}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
