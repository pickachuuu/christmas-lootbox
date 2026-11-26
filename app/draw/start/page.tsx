import type { Metadata } from "next";
import DrawStartForm from "./draw-start-form";

export const metadata: Metadata = {
  title: "Open the draw | Manito Manita",
  robots: { index: false, follow: false },
};

export default function DrawStartPage() {
  return (
    <main className="stage">
      <div className="card-frame">
        <section className="card" aria-labelledby="draw-start-title">
          <h1 id="draw-start-title">Open the draw</h1>
          <p className="screen-caption">Each guest needs at least one wishlist item before the draw can open.</p>
          <DrawStartForm />
        </section>
      </div>
    </main>
  );
}
