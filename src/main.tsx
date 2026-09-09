import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GameApp from "./GameApp";
import "./styles.css";
import "./expedition.css";

const root = document.getElementById("root");
if (!root) throw new Error("Application root was not found");

createRoot(root).render(
  <StrictMode>
    <GameApp />
  </StrictMode>,
);
