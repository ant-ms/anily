import { mountAnilyApp } from "@medialy/ui";

const app = mountAnilyApp(document.getElementById("app")!, {
  appId: "anily",
  appName: "Anily",
  appScheme: "anily",
  mediaLabelSingular: "anime",
  mediaLabelPlural: "anime",
  detailsTitle: "Anime Details",
  accentColor: "#ffd52c",
  features: {
    audioLanguageToggle: true,
    romanjiTitles: true,
  },
});

export default app;
