import type { Metadata } from "next";
import GameApp from "../src/GameApp";

export const metadata: Metadata = {
  title: "リズム・エクスプレス",
  description: "音楽に合わせてビート列車で3つの世界を旅する、子ども向けWebリズムゲーム",
};

export default function Home() {
  return <GameApp />;
}