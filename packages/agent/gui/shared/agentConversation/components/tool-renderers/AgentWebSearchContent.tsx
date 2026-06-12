import type { JSX } from "react";
import { translate } from "../../../../i18n/index";
import {
  arrayValue,
  optionRecord,
  stringValue,
  ToolMarkdownBlock,
  ToolSection,
  type AgentToolRendererProps
} from "./agentToolContentShared";
import { getWebSearchRenderData } from "./render-data/agentToolRenderData";

const MAX_SUMMARY_LENGTH = 3000;

export function AgentWebSearchContent({
  call,
  onLinkClick
}: AgentToolRendererProps): JSX.Element {
  "use memo";
  const web = getWebSearchRenderData(call);
  const queries = web.queries;
  const outputText = web.output ?? "";
  const links = normalizeLinks(call.output?.links, outputText);
  const summary = extractSummary(outputText) ?? (call.summary.trim() || null);
  const visibleSummary = summary ? summary.slice(0, MAX_SUMMARY_LENGTH) : null;

  return (
    <div className="workspace-agents-status-panel__detail-tool-body">
      {web.query ? (
        <ToolSection title={translate("agentHost.agentTool.details.query")}>
          <ToolMarkdownBlock content={web.query} onLinkClick={onLinkClick} />
        </ToolSection>
      ) : null}
      {queries.length > 0 ? (
        <ToolSection title={translate("agentHost.agentTool.details.results")}>
          <div className="workspace-agents-status-panel__detail-tool-result-list overflow-hidden rounded-[8px] border border-[var(--line-2)] bg-[var(--transparency-block)]">
            {queries.map((candidate, index) => (
              <div
                key={`${candidate}:${queries.length}`}
                className={`px-3 py-2 font-[var(--tsh-font-mono)] text-[11px] text-[var(--text-primary)] ${
                  index > 0 ? "border-t border-[var(--line-2)]" : ""
                }`}
              >
                {candidate}
              </div>
            ))}
          </div>
        </ToolSection>
      ) : null}
      {links.length > 0 ? (
        <ToolSection title={translate("agentHost.agentTool.details.results")}>
          <div className="workspace-agents-status-panel__detail-tool-result-list overflow-hidden rounded-[8px] border border-[var(--line-2)] bg-[var(--transparency-block)]">
            {links.map((link, index) => (
              <a
                key={`${link.url}:${link.title}`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-3 px-3 py-2 text-[11px] ${
                  index > 0 ? "border-t border-[var(--line-2)]" : ""
                }`}
              >
                <span className="w-[120px] shrink-0 truncate text-[11px] text-[var(--text-tertiary)]">
                  {link.domain}
                </span>
                <span className="truncate text-[var(--text-primary)]">
                  {link.title}
                </span>
              </a>
            ))}
          </div>
        </ToolSection>
      ) : null}
      {visibleSummary ? (
        <ToolSection title={translate("agentHost.agentTool.details.output")}>
          <ToolMarkdownBlock
            content={visibleSummary}
            onLinkClick={onLinkClick}
            collapsible
          />
        </ToolSection>
      ) : null}
      {summary && summary.length > MAX_SUMMARY_LENGTH ? (
        <div className="text-[10px] italic text-[var(--text-tertiary)]">
          {translate("agentHost.agentTool.details.summaryTruncated")}
        </div>
      ) : null}
      {web.error ? (
        <ToolSection title={translate("agentHost.agentTool.details.error")}>
          <ToolMarkdownBlock
            content={web.error}
            onLinkClick={onLinkClick}
            collapsible
          />
        </ToolSection>
      ) : null}
    </div>
  );
}

function normalizeLinks(
  value: unknown,
  output: string
): Array<{ title: string; url: string; domain: string }> {
  const explicitLinks =
    arrayValue(value)
      ?.map(optionRecord)
      .filter(
        (candidate): candidate is Record<string, unknown> => candidate !== null
      )
      .flatMap((link) => {
        const url = stringValue(link.url);
        if (!url) {
          return [];
        }
        return [
          {
            title: stringValue(link.title) ?? url,
            url,
            domain: domainForUrl(url)
          }
        ];
      }) ?? [];
  if (explicitLinks.length > 0) {
    return explicitLinks;
  }

  const match = output.match(/^Links:\s*(\[[\s\S]*?\])(?:\n\n|\n|$)/);
  if (!match) {
    return extractQuotedLinks(output);
  }
  try {
    const linksJson = match[1];
    if (!linksJson) {
      return extractQuotedLinks(output);
    }
    const parsed = JSON.parse(linksJson) as unknown[];
    return parsed.flatMap((entry) => {
      const link = optionRecord(entry);
      const url = stringValue(link?.url);
      if (!url) {
        return [];
      }
      return [
        {
          title: stringValue(link?.title) ?? url,
          url,
          domain: domainForUrl(url)
        }
      ];
    });
  } catch {
    return extractQuotedLinks(output);
  }
}

function extractQuotedLinks(
  output: string
): Array<{ title: string; url: string; domain: string }> {
  return Array.from(
    output.matchAll(/"title":"([^"]+)"\s*,\s*"url":"([^"]+)"/g)
  ).flatMap((entry) => {
    const title = entry[1];
    const url = entry[2];
    if (!title || !url) {
      return [];
    }
    return [{ title, url, domain: domainForUrl(url) }];
  });
}

function extractSummary(output: string): string | null {
  const trimmed = output.trim();
  if (!trimmed) {
    return null;
  }
  const withLinksRemoved = trimmed
    .replace(/^Links:\s*\[[\s\S]*?\](?:\n\n|\n)?/, "")
    .trim();
  return withLinksRemoved || (!trimmed.startsWith("Links:") ? trimmed : null);
}

function domainForUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
