import DefaultTheme from "vitepress/theme";
import SdHome from "./SdHome.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: import("vue").App }) {
    app.component("SdHome", SdHome);
  },
};
