import Exchange from "./exchange";

export default function Home() {
  const drawOpen = process.env.SANTA_SHUFFLE_DRAW_OPEN === "true";

  return (
    <main className="stage">
      <Exchange drawOpen={drawOpen} />
    </main>
  );
}
