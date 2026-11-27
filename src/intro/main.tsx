import { createRoot } from "react-dom/client";
import IntroApp from "./App";
import "../styles.css";
import "./intro.css";

createRoot(document.getElementById("root")!).render(<IntroApp />);
