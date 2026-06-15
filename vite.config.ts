import { defineConfig } from "vite";
import { resolve } from "path";

const page = (p: string) => resolve(__dirname, p);

export default defineConfig({
  base: "/",
  appType: "mpa",
  build: {
    target: "es2020",
    cssMinify: true,
    rollupOptions: {
      input: {
        main: page("index.html"),
        activites: page("activites/index.html"),
        salles: page("salles/index.html"),
        coachs: page("coachs/index.html"),
        galerie: page("galerie/index.html"),
        plannings: page("plannings/index.html"),
        tarifs: page("tarifs/index.html"),
        contact: page("contact/index.html"),
      },
    },
  },
});
