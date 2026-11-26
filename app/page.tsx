import { connection } from "next/server";
import { isDrawOpen } from "./draw-config";
import Exchange from "./exchange";

export default async function Home() {
  await connection();

  return (
    <main className="stage">
      <Exchange demoDrawOpen={isDrawOpen()} />
    </main>
  );
}
