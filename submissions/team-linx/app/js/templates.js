// ==============================================================================
// SANGAM - Event Templates & Intelligent Blueprint Generator
// Provides high-fidelity instant presets and local generation fallback
// ==============================================================================

export const EVENT_TEMPLATES = {
  wedding: {
    id: "wedding",
    name: "Wedding & Marriage Function",
    icon: "💍",
    tagline: "Tradition, celebration, and seamless hospitality",
    defaultTitle: "Grand Wedding Celebration",
    defaultVenue: "Royal Orchid Palace & Convention Hall",
    groups: [
      { name: "Catering & Dining", icon: "🍲", description: "Feast planning, welcome drinks, dining hall management & dietary preferences" },
      { name: "Stage & Decor", icon: "🌸", description: "Floral arrangements, mandap/stage styling, lighting ambiance & seating layout" },
      { name: "Hospitality & Guest Relations", icon: "🤝", description: "Guest welcoming, VIP protocol, room allocations & assistance desk" },
      { name: "Logistics & Transport", icon: "🚗", description: "Airport/station pick-ups, parking valet, vendor escort & supply transport" },
      { name: "Photography & Media", icon: "📸", description: "Candid photography, live drone feed, family portraits & instant video highlights" }
    ],
    roleSlots: [
      { title: "Head of Catering", responsibility: "Oversee dining schedule, buffet replenishment, and guest culinary experience", groupIndex: 0 },
      { title: "Stage & Mandap Coordinator", responsibility: "Ensure stage readiness, auspicious timing alignments, and ritual setup", groupIndex: 1 },
      { title: "Guest Concierge Lead", responsibility: "Coordinate guest check-in, family escort, and special hospitality requests", groupIndex: 2 },
      { title: "Transport Fleet Supervisor", responsibility: "Manage guest shuttle dispatch, airport transfers, and parking flow", groupIndex: 3 },
      { title: "Media Production Lead", responsibility: "Direct photographers and videographers for key ritual and candid moments", groupIndex: 4 }
    ],
    programmes: [
      { title: "Guest Welcome & Refreshments", startTime: "09:00", endTime: "10:30", venueOrStage: "Front Courtyard" },
      { title: "Main Wedding Ceremony & Rituals", startTime: "10:30", endTime: "12:30", venueOrStage: "Grand Central Mandap" },
      { title: "Royal Wedding Feast (Lunch)", startTime: "12:30", endTime: "15:00", venueOrStage: "Banquet Hall" },
      { title: "Evening Reception & Sangeet", startTime: "18:30", endTime: "22:00", venueOrStage: "Open Air Amphitheatre" }
    ]
  },

  hackathon: {
    id: "hackathon",
    name: "24-Hour Hackathon",
    icon: "💻",
    tagline: "High-energy innovation, mentorship, and sprint building",
    defaultTitle: "HackSangam 2026: 24-Hour Sprint",
    defaultVenue: "Tech Innovation Hub & Maker Labs",
    groups: [
      { name: "Tech Infrastructure & Mentors", icon: "⚡", description: "Wi-Fi resilience, API access support, cloud credits & 24/7 technical mentors" },
      { name: "Food & Midnight Snacks", icon: "🍕", description: "Energy snacks, meals, midnight pizza dispatch & non-stop coffee/tea bar" },
      { name: "Sponsorship & Swag", icon: "🎁", description: "Sponsor booth setup, developer swag bags, workshop tracks & partner engagement" },
      { name: "Judging & Scoring", icon: "⚖️", description: "Rubric enforcement, judge panel coordination, demo scheduling & scoring audit" },
      { name: "Stage, AV & Ceremonies", icon: "🎤", description: "Opening keynote, countdown timer display, audio/mic setup & pitch stream" }
    ],
    roleSlots: [
      { title: "Dev Infrastructure Lead", responsibility: "Ensure high-speed internet reliability, power strips, and server lab access", groupIndex: 0 },
      { title: "Mentor Helpdesk Lead", responsibility: "Route teams in distress to domain mentors in AI, Cloud, and Frontend", groupIndex: 0 },
      { title: "Catering & Energy Supply Lead", responsibility: "Coordinate breakfast, midnight snacks, and continuous beverages", groupIndex: 1 },
      { title: "Sponsor Liaison Lead", responsibility: "Manage partner tables, API credit distribution, and sponsor challenges", groupIndex: 2 },
      { title: "Pitch & Stage Floor Manager", responsibility: "Control demo timing, presentation slides, and judges' scoring sheets", groupIndex: 4 }
    ],
    programmes: [
      { title: "Check-in, Breakfast & Team Formation", startTime: "09:00", endTime: "10:30", venueOrStage: "Main Lobby" },
      { title: "Opening Ceremony & Problem Statements", startTime: "10:30", endTime: "11:30", venueOrStage: "Main Auditorium" },
      { title: "Hacking Commences & Mentor Round 1", startTime: "11:30", endTime: "18:00", venueOrStage: "Hacking Bay A & B" },
      { title: "Dinner & Midnight Lightning Trivia", startTime: "20:30", endTime: "00:00", venueOrStage: "Cafeteria & Lounge" },
      { title: "Code Freeze & Pitch Prep", startTime: "08:30", endTime: "10:00", venueOrStage: "Hacking Bay A" },
      { title: "Top 10 Demos, Judging & Awards", startTime: "10:30", endTime: "13:00", venueOrStage: "Main Auditorium" }
    ]
  },

  cultural: {
    id: "cultural",
    name: "College Cultural Fest",
    icon: "🎭",
    tagline: "Music, dance, star pro-nights, and creative showcases",
    defaultTitle: "Rhythm & Lights Cultural Fest",
    defaultVenue: "Campus Amphitheatre & Sports Arena",
    groups: [
      { name: "Stage & Acoustics", icon: "🎸", description: "Concert sound engineering, stage lighting, truss design & artist soundchecks" },
      { name: "Crowd Control & Security", icon: "🛡️", description: "Gate verification, barricade zones, emergency medical response & campus safety" },
      { name: "Artist Hospitality & VIP", icon: "⭐", description: "Celebrity artist escort, green room hospitality, riders & accommodation" },
      { name: "Tickets, Stalls & Merch", icon: "🎟️", description: "Entry wristbands, food stalls, festival merchandise & vendor coordination" },
      { name: "Media, PR & Live Coverage", icon: "📣", description: "Campus promotion, social media reels, photography & press relations" }
    ],
    roleSlots: [
      { title: "Chief Stage Floor Manager", responsibility: "Direct audio-visual transitions between band sets and dance competitions", groupIndex: 0 },
      { title: "Security & Gate Operations Lead", responsibility: "Maintain crowd safety, manage access passes, and monitor barricade lines", groupIndex: 1 },
      { title: "Celebrity Artist Liaison", responsibility: "Manage artist rider requirements, green room comfort, and schedule timing", groupIndex: 2 },
      { title: "Festival Stalls Coordinator", responsibility: "Organize campus food court vendors and official festival merch booth", groupIndex: 3 },
      { title: "PR & Broadcast Lead", responsibility: "Produce live streams, reels, and instant event announcements", groupIndex: 4 }
    ],
    programmes: [
      { title: "Grand Inauguration & Traditional Rhythms", startTime: "10:00", endTime: "12:00", venueOrStage: "Central Stage" },
      { title: "Inter-College Battle of the Bands", startTime: "13:00", endTime: "16:30", venueOrStage: "Open Air Arena" },
      { title: "Dance Drama & Fashion Showcase", startTime: "17:00", endTime: "19:30", venueOrStage: "Central Stage" },
      { title: "Celebrity Pro-Night & DJ Extravaganza", startTime: "20:00", endTime: "23:00", venueOrStage: "Main Concert Ground" }
    ]
  },

  conference: {
    id: "conference",
    name: "Tech Conference & Symposium",
    icon: "🚀",
    tagline: "Keynotes, developer breakout tracks, and networking expo",
    defaultTitle: "FutureTech Global Summit 2026",
    defaultVenue: "Metropolitan Convention & Expo Center",
    groups: [
      { name: "Speaker Operations & Tracks", icon: "🎤", description: "Keynote coordination, track moderators, slide deck checks & green room" },
      { name: "Audio/Visual & Broadcasting", icon: "📡", description: "Main auditorium AV, breakout mics, multi-cam live stream & recording" },
      { name: "Registration & Helpdesk", icon: "📋", description: "Badge printing, attendee check-in, info desk & lost-and-found" },
      { name: "Sponsor Expo & Booths", icon: "🏢", description: "Exhibitor floor layout, booth power, partner lounge & networking zones" },
      { name: "Catering & Networking Breaks", icon: "☕", description: "Morning coffee bar, networking buffet lunch & evening cocktail reception" }
    ],
    roleSlots: [
      { title: "Lead Speaker Host", responsibility: "Greet keynote speakers, review presentation slides, and manage Q&A mics", groupIndex: 0 },
      { title: "Chief AV Technician", responsibility: "Supervise stage lighting, audio fidelity, and high-definition live streams", groupIndex: 1 },
      { title: "Badge & Registration Manager", responsibility: "Ensure swift QR badge scanning and delegate pack distribution", groupIndex: 2 },
      { title: "Expo Hall Coordinator", responsibility: "Assist sponsor booths with power, swag setup, and lead capture", groupIndex: 3 }
    ],
    programmes: [
      { title: "Delegate Registration & Networking Coffee", startTime: "08:30", endTime: "09:30", venueOrStage: "Grand Foyer" },
      { title: "Opening Keynote: The AI Era", startTime: "09:30", endTime: "11:00", venueOrStage: "Auditorium A" },
      { title: "Parallel Breakout Tracks & Workshops", startTime: "11:15", endTime: "13:00", venueOrStage: "Halls B & C" },
      { title: "Networking Lunch & Sponsor Expo", startTime: "13:00", endTime: "14:30", venueOrStage: "Exhibition Hall" },
      { title: "Executive Panel & Closing Ceremony", startTime: "16:00", endTime: "17:30", venueOrStage: "Auditorium A" }
    ]
  }
};

export function getAllTemplates() {
  return Object.values(EVENT_TEMPLATES);
}

export function getTemplate(templateId) {
  return EVENT_TEMPLATES[templateId] ? JSON.parse(JSON.stringify(EVENT_TEMPLATES[templateId])) : null;
}

// CONTRACT
// GUARANTEES: Returns a complete, valid event blueprint matching the required schema.
// DOES NOT: make network calls or fail if offline.
export function generateLocalBlueprint(userPrompt = "", baseTemplateKey = "hackathon") {
  const base = getTemplate(baseTemplateKey) || getTemplate("hackathon");
  const prompt = userPrompt.trim();
  if (!prompt) {
    return {
      title: base.defaultTitle,
      venue: base.defaultVenue,
      groups: base.groups,
      roleSlots: base.roleSlots,
      programmes: base.programmes
    };
  }

  const lower = prompt.toLowerCase();
  let title = base.defaultTitle;
  let venue = base.defaultVenue;

  // Extract custom event title if specified
  const titleMatch = prompt.match(/(?:for|called|named|title(?:d)?)\s+["']?([^"',.]+?)["']?(?:\s+(?:with|at|in|on)|$)/i);
  if (titleMatch && titleMatch[1]?.trim()) {
    title = titleMatch[1].trim();
  } else if (prompt.length < 50 && !prompt.includes(" ")) {
    title = prompt;
  }

  // Extract venue if specified
  const venueMatch = prompt.match(/(?:at|venue|location)\s+["']?([^"',.]+?)["']?(?:\s+(?:with|for|on)|$)/i);
  if (venueMatch && venueMatch[1]?.trim()) {
    venue = venueMatch[1].trim();
  }

  // Clone base elements
  const groups = [...base.groups];
  const roleSlots = [...base.roleSlots];
  const programmes = [...base.programmes];

  // Dynamic keyword additions based on prompt concepts
  if (/gaming|esports|game|lan/i.test(lower)) {
    if (!groups.some(g => /gaming|esport/i.test(g.name))) {
      groups.push({ name: "Gaming & Esports Arena", icon: "🎮", description: "Gaming setups, tournament brackets, streaming screens & refereeing" });
      const idx = groups.length - 1;
      roleSlots.push({ title: "Esports Tournament Marshal", responsibility: "Organize gaming brackets, rules enforcement, and referee dispute resolution", groupIndex: idx });
      roleSlots.push({ title: "Live Streaming Technician", responsibility: "Manage OBS feeds, gamer webcams, and commentary audio mixing", groupIndex: idx });
      programmes.push({ title: "Inter-Team Esports Championship", startTime: "21:00", endTime: "23:30", venueOrStage: "Gaming Lounge" });
    }
  }

  if (/music|concert|dj|dance|band/i.test(lower)) {
    if (!groups.some(g => /acoustic|music|artist/i.test(g.name))) {
      groups.push({ name: "Entertainment & Artist Hospitality", icon: "🎵", description: "Music artists, DJ line-up, sound checks & rider arrangements" });
      const idx = groups.length - 1;
      roleSlots.push({ title: "Artist Hospitality Manager", responsibility: "Coordinate artist green room, refreshments, and stage handoffs", groupIndex: idx });
    }
  }

  if (/security|safety|medical|paramedic|crowd/i.test(lower)) {
    if (!groups.some(g => /security|safety|crowd/i.test(g.name))) {
      groups.push({ name: "Safety, Security & Medical", icon: "🚑", description: "First aid station, emergency exits, crowd flow & security personnel" });
      const idx = groups.length - 1;
      roleSlots.push({ title: "Chief Safety Officer", responsibility: "Oversee emergency response protocols and first-aid station staffing", groupIndex: idx });
    }
  }

  if (/haldi|mehndi|sangeet/i.test(lower)) {
    programmes.push({ title: "Haldi & Mehndi Celebration", startTime: "16:00", endTime: "18:30", venueOrStage: "Garden Courtyard" });
  }

  if (/workshop|hands-on|training/i.test(lower)) {
    programmes.push({ title: "Hands-on Technical Workshops", startTime: "14:00", endTime: "16:00", venueOrStage: "Lab 3" });
  }

  return {
    title,
    venue,
    groups,
    roleSlots,
    programmes
  };
}
