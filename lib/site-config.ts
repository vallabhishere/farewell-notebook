/**
 * Personalize this copy by editing these values. Keep secrets in your hosting
 * provider's environment settings; never put API keys in this file.
 */
export const farewellConfig = {
  authorName: "Your Name",
  signoff: "WITH GRATITUDE · HOPING TO STAY CONNECTED",
  wordmarkTagline: "still talking.",
  edition: "A FAREWELL, WITH A LITTLE EXTRA",
  openingLabel: "One last note before I go",
  openingEyebrow: "A NOTE TO MARK THE MOMENT",
  headlineFirstLine: "One chapter ends.",
  headlineSecondLine: "The good parts stay.",
  introduction: "A little goodbye note, with a few things to explore along the way.",
  openings: [
    "I could have sent a standard farewell note. But where’s the fun in that?",
    "I’m moving on, but the good stories are coming with me.",
    "A new chapter starts soon. I promise to make the transition sound more organized than it was.",
    "A proper goodbye felt too formal. So here’s a little something instead.",
  ],
  reflections: [
    "I’ll remember the conversations, the laughs, and all the little moments that made this chapter special.",
    "Somewhere between the busy days and the quick chats, work became much more than work. That’s what I’ll carry with me.",
    "The work will carry on. I’ll miss the people who made doing it worthwhile.",
    "There were good days, long days, and plenty of conversations that wandered off the agenda. Those are the moments I’ll remember.",
  ],
  closings: [
    "I’m looking forward to what comes next. I hope we stay in touch.",
    "A new chapter is ahead, and I’m taking the good memories with me.",
    "Here’s to new beginnings, familiar faces, and keeping in touch along the way.",
    "I’m moving on to something new. The phone number stays the same.",
    "On to the next adventure, with gratitude for the people who made this one matter.",
  ],
  previousChapter: "Your previous team",
  nextChapter: "What comes next",
  social: {
    linkedin: "",
    whatsappNumber: "", // International format, digits only, e.g. 14155550123
    instagram: "",
  },
  project: {
    enabled: true,
    name: "Your side project",
    teaser: "A short introduction to something you’re building.",
    headline: "Your project headline goes here.",
    description: "Add a couple of lines about the project and why it matters to you.",
    callToAction: "Learn more",
    url: "",
    image: "", // Optional path under /public, e.g. /project-art.jpg
  },
  stockEnvelope: {
    enabled: true,
    title: "Stock ideas",
    tagline: "Your market saying goes here",
    prompt: "If you could buy one stock today and leave it to your kids, which would it be?",
  },
  envelopeCopy: {
    memory: { title: "This stays between us.", teaser: "A memory, a message, or a story worth keeping.", note: "No public wall. Promise." },
    detour: { title: "Send me on a detour.", teaser: "A book, a place, an adventure. Pick my next detour.", note: "I accept curated chaos." },
    catchup: { title: "A catch-up. No agenda.", teaser: "Coffee, lunch, dinner—or a drink. Pick the setting.", note: "Good company is a valid calendar invite." },
  },
  analyticsEnabled: false,
  initialVisitCount: 0,
} as const;
