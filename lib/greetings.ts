export type GreetingRecord = {
  id: string;
  displayName: string;
  firstName: string;
  aliases: string[];
  /** Put this person's private, custom paragraph here. */
  message: string;
  salutation?: string;
  greetingPrefix?: string;
};

/**
 * Add optional person-specific notes here. Leave this empty to use the generic
 * note options for everyone. Names and aliases are only used to find a match;
 * unknown names always receive the generic note.
 *
 * Example:
 * {
 *   id: "sample-person",
 *   displayName: "Sample Person",
 *   firstName: "Sample",
 *   aliases: ["Sam Person"],
 *   message: "Add a personal memory here. This replaces only the personal paragraph.",
 * }
 */
export const personalizedGreetings: GreetingRecord[] = [];

const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

export function matchGreeting(value: string): { kind: "none" } | { kind: "unique"; person: GreetingRecord } | { kind: "ambiguous"; people: GreetingRecord[] } {
  const input = normalize(value);
  const exact = personalizedGreetings.filter((person) => [person.displayName, ...person.aliases].some((alias) => normalize(alias) === input));
  if (exact.length === 1) return { kind: "unique", person: exact[0] };
  if (exact.length > 1) return { kind: "ambiguous", people: exact };

  const firstName = input.split(" ")[0];
  const matches = personalizedGreetings.filter((person) => normalize(person.firstName) === firstName);
  if (matches.length === 1) return { kind: "unique", person: matches[0] };
  if (matches.length > 1) return { kind: "ambiguous", people: matches };
  return { kind: "none" };
}
