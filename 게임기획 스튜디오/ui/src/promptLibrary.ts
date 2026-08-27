import type { SavedPrompt } from './types';

export interface PromptCompositionInput {
  beginning: string;
  content: string;
  ending: string;
  negativePrompt: string;
  searchOptions: string;
  removeDuplicateTags: boolean;
  variableDefaults: Record<string, string>;
}

export interface PromptCompositionResult {
  positiveText: string;
  negativeText: string;
  combinedText: string;
  includedTags: string[];
  excludedTags: string[];
}

export function extractPromptVariables(content: string): string[] {
  const names: string[] = [];
  for (const match of content.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/gu)) {
    const name = match[1]?.trim();
    if (name && !names.includes(name) && names.length < 24) names.push(name);
  }
  return names;
}

export function renderPrompt(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (token, rawName: string) => {
    const name = rawName.trim();
    return values[name] === undefined ? token : values[name];
  });
}

function splitTags(value: string): string[] {
  return value.replace(/\r?\n/gu, ',').split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizedTag(value: string): string {
  return value.replace(/[{}\[\]]/gu, '').replaceAll('_', ' ').trim().toLocaleLowerCase('en-US');
}

export function applyDynamicChoices(value: string, random: () => number = Math.random): string {
  let result = value;
  for (let pass = 0; pass < 24; pass += 1) {
    const replaced = result.replace(/<([^<>]*\|[^<>]*)>/gu, (_token, options: string) => {
      const candidates = options.split('|').map((item) => item.trim()).filter(Boolean);
      if (candidates.length === 0) return '';
      return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
    });
    if (replaced === result) break;
    result = replaced;
  }
  return result;
}

export function composePrompt(
  input: PromptCompositionInput,
  random: () => number = Math.random,
): PromptCompositionResult {
  const resolve = (value: string) => applyDynamicChoices(renderPrompt(value, input.variableDefaults), random);
  const beginning = splitTags(resolve(input.beginning));
  const body = splitTags(resolve(input.content));
  const ending = splitTags(resolve(input.ending));
  const negative = splitTags(resolve(input.negativePrompt));
  const search = splitTags(resolve(input.searchOptions));
  const includedTags = search.filter((tag) => !tag.startsWith('~'));
  const excludedTags = search.filter((tag) => tag.startsWith('~')).map((tag) => tag.slice(1).trim()).filter(Boolean);
  const blocked = new Set([...negative, ...excludedTags].map(normalizedTag));
  const positive = [...beginning, ...includedTags, ...body.filter((tag) => !blocked.has(normalizedTag(tag))), ...ending];
  const finalPositive = input.removeDuplicateTags
    ? positive.filter((tag, index, source) => source.findIndex((candidate) => normalizedTag(candidate) === normalizedTag(tag)) === index)
    : positive;
  const positiveText = finalPositive.join(', ');
  const negativeText = negative.join(', ');
  return {
    positiveText,
    negativeText,
    combinedText: negativeText ? `${positiveText}\n\nNegative Prompt:\n${negativeText}` : positiveText,
    includedTags,
    excludedTags,
  };
}

export function filterAndSortPrompts(
  prompts: SavedPrompt[],
  query: string,
  sortBy: 'lastUsed' | 'updated' | 'title',
): SavedPrompt[] {
  const normalized = query.trim().toLocaleLowerCase('ko-KR');
  const filtered = normalized
    ? prompts.filter((prompt) => [
      prompt.title, prompt.description, prompt.beginning, prompt.searchOptions, prompt.content,
      prompt.ending, prompt.negativePrompt, prompt.category,
      prompt.target, prompt.model, ...prompt.tags,
    ].some((value) => value.toLocaleLowerCase('ko-KR').includes(normalized)))
    : prompts;
  return [...filtered].sort((left, right) => {
    if (sortBy === 'title') return left.title.localeCompare(right.title, 'ko-KR');
    const leftDate = sortBy === 'lastUsed' ? left.lastUsedAt || left.updatedAt : left.updatedAt;
    const rightDate = sortBy === 'lastUsed' ? right.lastUsedAt || right.updatedAt : right.updatedAt;
    return rightDate.localeCompare(leftDate);
  });
}
