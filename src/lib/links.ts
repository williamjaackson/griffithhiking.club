/** The club's three external homes. Referenced by the join dialog and by the
 *  hero's no-JavaScript fallback, so they live in one place. */
export const links = {
  campusGroups: "https://griffith.campusgroups.com/Hikingclub/club_signup",
  whatsapp: "https://chat.whatsapp.com/C9wxhtt5bvh4P89fVc2Yzl?mode=gi_t",
  instagram: "https://www.instagram.com/griffithhikingclub/",
} as const;

/** Presented as three equal options rather than ranked steps. */
export const joinLinks = [
  {
    id: "campus-groups",
    name: "Campus Groups",
    detail: "Membership registration",
    href: links.campusGroups,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    detail: "Hike coordinating, car pooling, on-the-day information",
    href: links.whatsapp,
  },
  {
    id: "instagram",
    name: "Instagram",
    detail: "Pictures, videos, and hike announcements",
    href: links.instagram,
  },
] as const;
