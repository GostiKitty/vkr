import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  LAW87_BREADCRUMBS,
  LAW87_CENTER_TITLE_LINES,
  LAW87_MAIN_TITLE,
  LAW87_NAVIGATION,
  LAW87_SOURCE_TITLE,
  LAW87_SOURCE_URL,
  LAW87_STATUS_TEXT,
  PROJECT_DOCUMENTATION_LAW87_SECTIONS,
  type Law87AnchorId,
  type Law87Section,
  type Law87SectionItem,
} from "../../data/projectDocumentationLaw87";

interface NormativeDocumentPageProps {
  toolbar?: ReactNode;
}

export function NormativeDocumentPage({ toolbar }: NormativeDocumentPageProps) {
  const [searchValue, setSearchValue] = useState("");
  const deferredQuery = useDeferredValue(searchValue.trim());
  const anchorRefs = useRef<Partial<Record<Law87AnchorId, HTMLElement | null>>>({});

  const matchingSectionIds = useMemo(
    () =>
      PROJECT_DOCUMENTATION_LAW87_SECTIONS.filter((section) => sectionContainsQuery(section, deferredQuery)).map(
        (section) => section.anchorId
      ),
    [deferredQuery]
  );

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!matchingSectionIds.length) {
      return;
    }
    const firstMatch = anchorRefs.current[matchingSectionIds[0]];
    firstMatch?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navigateToAnchor = (anchorId: Law87AnchorId) => {
    anchorRefs.current[anchorId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="legal-page" id="legal-document">
      <div className="legal-topbar document-print-hidden">
        <nav className="legal-breadcrumbs" aria-label="Навигационная цепочка">
          {LAW87_BREADCRUMBS.map((item, index) => {
            const href = "href" in item ? item.href : undefined;
            return (
              <span key={`${item.label}-${index}`}>
                {href ? (
                  <a
                    className="legal-breadcrumb-link"
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noreferrer" : undefined}
                  >
                    {item.label}
                  </a>
                ) : (
                  <span className="legal-muted">{item.label}</span>
                )}
                {index < LAW87_BREADCRUMBS.length - 1 ? <span className="legal-muted"> / </span> : null}
              </span>
            );
          })}
        </nav>
        <div className="legal-right-tools legal-right-tools--inline">{toolbar}</div>
      </div>

      <div className="legal-page__layout">
        <main className="legal-content">
          <p className="legal-status">{LAW87_STATUS_TEXT}</p>
          <a className="legal-source-link legal-link" href={LAW87_SOURCE_URL} target="_blank" rel="noreferrer">
            {LAW87_SOURCE_TITLE}
          </a>

          <h1 className="legal-document-title">{LAW87_MAIN_TITLE}</h1>

          <div className="legal-section-title">
            {LAW87_CENTER_TITLE_LINES.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>

          <form className="legal-search-panel document-print-hidden" role="search" onSubmit={handleSearchSubmit}>
            <label htmlFor="legal-document-search" className="legal-muted">
              Поиск по документу
            </label>
            <div className="legal-search-panel__controls">
              <input
                id="legal-document-search"
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Поиск по документу"
                className="ui-field"
              />
              <button type="submit" className="ui-btn-secondary px-3 py-2 text-sm">
                Найти
              </button>
            </div>
            <p className="legal-muted">
              {deferredQuery
                ? matchingSectionIds.length
                  ? `Найдено разделов: ${matchingSectionIds.length}.`
                  : "Совпадения не найдены."
                : "Поиск подсвечивает найденные фрагменты и переводит к первому совпавшему разделу."}
            </p>
          </form>

          {PROJECT_DOCUMENTATION_LAW87_SECTIONS.map((section) => (
            <section
              key={section.anchorId}
              id={section.anchorId}
              className="legal-anchor"
              ref={(node) => {
                anchorRefs.current[section.anchorId] = node;
              }}
            >
              <h2>{section.heading}</h2>
              {section.lead?.map((paragraph) => (
                <p key={paragraph} className="legal-paragraph legal-muted">
                  {renderHighlightedText(paragraph, deferredQuery)}
                </p>
              ))}
              {section.items.map((item, index) => renderSectionItem(item, deferredQuery, `${section.anchorId}-${index}`))}
            </section>
          ))}
        </main>

        <aside className="legal-right-tools legal-right-tools--nav document-print-hidden" aria-label="Навигация по разделам">
          <p className="legal-muted">По разделам</p>
          <nav>
            {LAW87_NAVIGATION.map((item) => {
              const active = matchingSectionIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`legal-anchor-link${active ? " is-match" : ""}`}
                  onClick={() => navigateToAnchor(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>
      </div>
    </div>
  );
}

function renderSectionItem(item: Law87SectionItem, query: string, key: string) {
  if (item.type === "note") {
    return (
      <div key={key} className="legal-note">
        <div className="legal-note-title">{renderHighlightedText(item.title, query)}</div>
        <p className="legal-paragraph">{renderHighlightedText(item.text, query)}</p>
        {item.paragraphs?.map((paragraph) => (
          <p key={paragraph} className="legal-subpoint">
            {renderHighlightedText(paragraph, query)}
          </p>
        ))}
      </div>
    );
  }

  return (
    <article key={key}>
      <p className="legal-point">
        <span className="legal-point-number">{renderHighlightedText(`${item.number}.`, query)}</span>{" "}
        {item.title ? renderHighlightedText(item.title, query) : renderHighlightedText(item.text ?? "", query)}
      </p>

      {!item.title && item.text ? null : item.text ? (
        <p className="legal-paragraph">{renderHighlightedText(item.text, query)}</p>
      ) : null}

      {item.intro ? <p className="legal-paragraph legal-muted">{renderHighlightedText(item.intro, query)}</p> : null}

      {item.subpoints?.map((subpoint) => (
        <div key={`${key}-${subpoint.letter}`} className="legal-subpoint">
          <p className="legal-paragraph">
            <span className="legal-subpoint-letter">{subpoint.letter})</span>{" "}
            {renderHighlightedText(subpoint.text, query)}
          </p>
          {subpoint.details?.map((detail) => (
            <p key={detail} className="legal-paragraph legal-subpoint legal-subpoint-detail">
              {renderHighlightedText(detail, query)}
            </p>
          ))}
        </div>
      ))}

      {item.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="legal-paragraph">
          {renderHighlightedText(paragraph, query)}
        </p>
      ))}

      {item.editorialNotes?.map((note) => (
        <p key={note} className="legal-editorial-note">
          {renderHighlightedText(note, query)}
        </p>
      ))}

      {item.oldEditionLabel ? (
        <p className="legal-old-edition-link">
          <a className="legal-link" href={LAW87_SOURCE_URL} target="_blank" rel="noreferrer">
            {renderHighlightedText(`(${item.oldEditionLabel})`, query)}
          </a>
        </p>
      ) : null}
    </article>
  );
}

function sectionContainsQuery(section: Law87Section, query: string) {
  if (!query) {
    return false;
  }
  const haystack = [
    section.heading,
    ...(section.lead ?? []),
    ...section.items.flatMap((item) =>
      item.type === "note"
        ? [item.title, item.text, ...(item.paragraphs ?? [])]
        : [
            item.number,
            item.title ?? "",
            item.text ?? "",
            item.intro ?? "",
            ...(item.paragraphs ?? []),
            ...(item.editorialNotes ?? []),
            ...(item.subpoints?.flatMap((subpoint) => [subpoint.letter, subpoint.text, ...(subpoint.details ?? [])]) ?? []),
          ]
    ),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function renderHighlightedText(text: string, query: string) {
  if (!query) {
    return text;
  }
  const escaped = escapeRegExp(query);
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  const normalizedQuery = query.toLowerCase();
  return parts.map((part, index) =>
    part.toLowerCase() === normalizedQuery ? <mark key={`${part}-${index}`}>{part}</mark> : <span key={`${part}-${index}`}>{part}</span>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default NormativeDocumentPage;
