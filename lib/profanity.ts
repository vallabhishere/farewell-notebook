// Common English, Hindi and Marathi terms plus frequent Roman spellings.
// Keep entries as whole tokens so ordinary names such as "Shitanshu" don't match.
const blockedTokens = new Set(`
asshole asswhole bastard bitch bitches bullshit bullshitting crap cunt cunts damn dick dickhead dumbass fag faggot fuck fucker fuckers fuckface fuckhead fucking motherfucker motherfuckers piss pissed piss off prick shit shits shitty slut sluts twat wanker whore whores
chut choot chooth chutiya chutia chutiyah chutiye chutiyaa chootiya chootia chootiye chutiyapa
madarchod madarchodd madarchoot madarchut madarch0d madharchod madarchoddd
behenchod bhenchod behanchod bhenchodd behenchut bhenchut behenchoot bhenchoot
bhosdike bhosadike bhosadi bhosdi bhosdika bhosda bhosada bhosra bhosdikee bhosdki bhosdky bhosdk bosdk bsdk bosdike bosdi bosdika bhonsdike bhonsdi bhosadchod
gaand gaanduu gandu gaandu ganduu gandvi gandmara
lund lundh loda lauda lavda lawda laude lavde lode lvd lodu lundiya
harami haraami haramkhor kamina kameena kamine kameeni randi randwa randa jhaatu jhatu jhaant jhaantoo bhadwa bhadwe bhadva bhadve chinal
चुत चूत चूट चूतिया चूतिये चूतियापना चूतड़ चूतड मादरचोद मादरचूत मदरचोद बहनचोद बहनचूत बहनचुत भोसड़ी भोसडी भोसड़ीके भोसडीके भोसड़ा भोसडा भोसडिके गांड गांडू गांडू हरामी हरामखोर कमीना कमीने कमीनी रंडी रांड लवड़ा लौड़ा लवडे लौडे लंड लांड़ झाटू झांट भड़वा भड़वे छिनाल
`.trim().split(/\s+/u));

// These have likely benign meanings in ordinary sentences (especially "land"),
// but should still be caught when entered as someone's name.
const nameOnlyTokens = new Set(["land", "laand", "gand"]);

function normalizeLatinLookalikes(value: string): string {
  return value.replace(/[013457@$]/gu, (character) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" })[character] ?? character);
}

function compactRepeatedLatinLetters(value: string): string {
  return value.replace(/([a-z])\1+/gu, "$1");
}

export function containsProfanity(value: string, context: "name" | "content" = "content"): boolean {
  const normalized = normalizeLatinLookalikes(value.normalize("NFKC").toLocaleLowerCase("en").replace(/[\u200B-\u200D\uFEFF]/gu, ""));
  // Also join punctuation-separated spellings such as b.h.o.s.d.k, while spaces
  // remain token boundaries to reduce accidental matches in normal writing.
  const candidates = normalized.match(/[\p{L}\p{M}\p{N}]+(?:[._*~\-][\p{L}\p{M}\p{N}]+)*/gu) ?? [];
  return candidates.some((candidate) => {
    const token = compactRepeatedLatinLetters(candidate.replace(/[._*~\-]/gu, ""));
    const rawToken = candidate.replace(/[._*~\-]/gu, "");
    return blockedTokens.has(token) || blockedTokens.has(rawToken) ||
      (context === "name" && (nameOnlyTokens.has(token) || nameOnlyTokens.has(rawToken)));
  });
}
