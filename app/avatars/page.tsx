import type { Metadata } from "next";
import Studio from "./studio";
import "./studio.css";

export const metadata: Metadata = {
  title: "Avatar Studio | Santa Shuffle",
};

export default function AvatarStudioPage() {
  return (
    <main className="stage studio-stage">
      <Studio />
    </main>
  );
}
