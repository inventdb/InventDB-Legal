import { Composition } from "remotion";

import { Film } from "./Film";
import { FPS, H, W } from "./theme";

export const RemotionRoot = () => (
  <>
    <Composition id="LegalDemo3" component={Film} durationInFrames={180 * FPS} fps={FPS} width={W} height={H} defaultProps={{ cut: "short" as const }} />
    <Composition id="LegalDemo5" component={Film} durationInFrames={300 * FPS} fps={FPS} width={W} height={H} defaultProps={{ cut: "long" as const }} />
  </>
);
