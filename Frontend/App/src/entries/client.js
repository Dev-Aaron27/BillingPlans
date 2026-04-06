import { createApp } from "vue";
import "../style.css";
import Client from "../pages/Client.vue";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";
const app = createApp(Client);
app.use(Toast, {
    transition: "Vue-Toastification__bounce",
    maxToasts: 20,
    newestOnTop: true,
});
document.documentElement.classList.add("dark");
document.body.style.background = "transparent";
document.documentElement.style.background = "transparent";
if (document.body.parentElement) {
    document.body.parentElement.style.background = "transparent";
}
app.mount("#app");
