"use client";

import { useEffect, useRef } from "react";
import type { AvatarLook } from "./avatar-options";
import { paintAvatar } from "./pixel-art";

export default function PixelAvatar({ look, label }: { look: AvatarLook; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (context) paintAvatar(context, look);
  }, [look]);

  return (
    <canvas
      ref={canvas}
      className="pixel-avatar"
      width={32}
      height={32}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
