import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const ORB_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
  />

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent;
    }

    body {
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      background: transparent;
    }
  </style>
</head>

<body>

<canvas id="orbCanvas"></canvas>

<script>
(function () {

  const canvas = document.getElementById('orbCanvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return;
  }

  let centerX = 0;
  let centerY = 0;
  let baseRadius = 45;

  let audioLevel = 0;
  let isTalking = false;
  let time = 0;

  // Real-time output volume (0-1), pushed in from React Native via
  // window.setAudioLevel(). This is what makes the orb react to the
  // actual loudness of what the AI is saying, instead of a generic
  // synthetic wave.
  let targetAudioLevel = 0;

  // Default orb colors
  let colorCenter = '#93C5FD';
  let colorMid = '#3B82F6';
  let colorOuter = '#1D4ED8';

  function resize() {

    const width = window.innerWidth || 240;
    const height = window.innerHeight || 240;

    const size = Math.min(width, height);

    const dpr = window.devicePixelRatio || 1;

    canvas.width = size * dpr;
    canvas.height = size * dpr;

    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    centerX = size / 2;
    centerY = size / 2;

    baseRadius = size * 0.19;
  }

  window.addEventListener('resize', resize);

  resize();

  function hexToRgb(hex) {

    const value = parseInt(
      hex.replace('#', ''),
      16
    );

    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  }

  // React Native controls whether the orb is talking
  window.setTalking = function(value) {
    isTalking = !!value;
  };

  // React Native pushes the AI's real, live output volume here — a
  // number between 0 (silent) and 1 (loudest). Called every animation
  // frame while the agent is speaking.
  window.setAudioLevel = function(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      return;
    }
    targetAudioLevel = Math.max(0, Math.min(1, value));
  };

  // React Native controls orb colors
  window.setColors = function(colors) {

    if (!colors) return;

    if (colors.center) {
      colorCenter = colors.center;
    }

    if (colors.mid) {
      colorMid = colors.mid;
    }

    if (colors.outer) {
      colorOuter = colors.outer;
    }
  };

  function drawOrb() {

    const width =
      canvas.width /
      (window.devicePixelRatio || 1);

    const height =
      canvas.height /
      (window.devicePixelRatio || 1);

    // Clear everything so the background stays transparent
    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    // Talking animation — now driven by the AI's real output volume,
    // with a light organic wobble layered on top so it doesn't look
    // perfectly mechanical.
    if (isTalking) {

      const wobble =
        Math.sin(time * 8) * 0.08 +
        Math.cos(time * 15) * 0.05;

      const targetLevel =
        Math.max(0.08, targetAudioLevel) +
        wobble;

      // Faster response (0.35 vs the old 0.1) so the orb visibly
      // tracks real speech bursts instead of lagging behind them.
      audioLevel +=
        (targetLevel - audioLevel) * 0.35;

    } else {

      audioLevel +=
        (0 - audioLevel) * 0.05;
    }

    time += 0.03;

    const dynamicRadius =
      baseRadius +
      audioLevel * 35;

    const waveAmplitude =
      8 +
      audioLevel * 20;

    const rgbCenter =
      hexToRgb(colorCenter);

    const rgbMid =
      hexToRgb(colorMid);

    const rgbOuter =
      hexToRgb(colorOuter);

    // ==========================================
    // LAYER 1 — OUTER GLOW
    // ==========================================

    const outerGlow =
      ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        dynamicRadius * 1.8
      );

    outerGlow.addColorStop(
      0,
      'rgba(' +
        rgbMid.r +
        ',' +
        rgbMid.g +
        ',' +
        rgbMid.b +
        ',0.45)'
    );

    outerGlow.addColorStop(
      0.5,
      'rgba(' +
        rgbOuter.r +
        ',' +
        rgbOuter.g +
        ',' +
        rgbOuter.b +
        ',0.20)'
    );

    // Completely transparent edge
    outerGlow.addColorStop(
      1,
      'rgba(0,0,0,0)'
    );

    ctx.fillStyle = outerGlow;

    ctx.beginPath();

    ctx.arc(
      centerX,
      centerY,
      dynamicRadius * 1.8,
      0,
      Math.PI * 2
    );

    ctx.fill();

    // ==========================================
    // LAYER 2 — FLUID INNER CORE
    // ==========================================

    const coreGradient =
      ctx.createRadialGradient(
        centerX + Math.sin(time) * 12,
        centerY + Math.cos(time) * 12,
        5,
        centerX,
        centerY,
        dynamicRadius * 0.85
      );

    coreGradient.addColorStop(
      0,
      colorCenter
    );

    coreGradient.addColorStop(
      0.4,
      colorMid
    );

    coreGradient.addColorStop(
      0.75,
      colorOuter
    );

    // Transparent edge instead of black
    coreGradient.addColorStop(
      1,
      'rgba(15,10,30,0)'
    );

    ctx.save();

    ctx.shadowColor = colorMid;
    ctx.shadowBlur = 25;

    ctx.fillStyle = coreGradient;

    ctx.beginPath();

    ctx.arc(
      centerX,
      centerY,
      dynamicRadius * 0.82,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();

    // ==========================================
    // LAYER 3 — PARTICLE MESH
    // ==========================================

    const rows = 28;
    const pointsPerRow = 45;

    ctx.save();

    ctx.globalCompositeOperation =
      'lighter';

    for (
      let r = 0;
      r < rows;
      r++
    ) {

      const lat =
        (r / rows) *
        Math.PI -
        Math.PI / 2;

      const radiusAtLat =
        dynamicRadius *
        Math.cos(lat);

      const y =
        centerY +
        dynamicRadius *
        Math.sin(lat);

      ctx.beginPath();

      for (
        let p = 0;
        p <= pointsPerRow;
        p++
      ) {

        const lon =
          (p / pointsPerRow) *
          Math.PI *
          2;

        const wave =
          Math.sin(
            lon * 4 +
            time * 2 +
            r * 0.3
          ) *
          Math.cos(
            lat * 3 -
            time * 1.5
          ) *
          waveAmplitude;

        const x =
          centerX +
          (radiusAtLat + wave) *
          Math.cos(lon);

        const pointY =
          y +
          Math.sin(
            lon * 2 +
            time
          ) *
          (wave * 0.3);

        if (p === 0) {

          ctx.moveTo(
            x,
            pointY
          );

        } else {

          ctx.lineTo(
            x,
            pointY
          );
        }

        const rowRatio =
          r / rows;

        const prR =
          Math.floor(
            rgbMid.r +
            (rgbOuter.r - rgbMid.r) *
            rowRatio
          );

        const prG =
          Math.floor(
            rgbMid.g +
            (rgbOuter.g - rgbMid.g) *
            rowRatio
          );

        const prB =
          Math.floor(
            rgbMid.b +
            (rgbOuter.b - rgbMid.b) *
            rowRatio
          );

        const alpha =
          0.25 +
          (Math.sin(
            lon + time
          ) + 1) *
          0.35;

        ctx.fillStyle =
          'rgba(' +
          prR +
          ',' +
          prG +
          ',' +
          prB +
          ',' +
          alpha +
          ')';

        ctx.fillRect(
          x - 1,
          pointY - 1,
          2.5,
          2.5
        );
      }

      const strandAlpha =
        0.08 +
        (r / rows) *
        0.12;

      ctx.strokeStyle =
        'rgba(' +
        rgbCenter.r +
        ',' +
        rgbCenter.g +
        ',' +
        rgbCenter.b +
        ',' +
        strandAlpha +
        ')';

      ctx.lineWidth = 1.2;

      ctx.stroke();
    }

    ctx.restore();

    requestAnimationFrame(drawOrb);
  }

  drawOrb();

})();
</script>

</body>
</html>
`;

interface OrbColors {
  center?: string;
  mid?: string;
  outer?: string;
}

interface VoiceOrbProps {
  isTalking?: boolean;
  size?: number;
  colors?: OrbColors;
}

// Exposes an imperative handle so the parent screen can push real-time
// audio level updates every animation frame WITHOUT going through React
// state/props — that would re-render the whole screen 60x/second. This
// stays a plain direct call into the WebView instead.
export interface VoiceOrbHandle {
  setAudioLevel: (level: number) => void;
}

const VoiceOrb = forwardRef<VoiceOrbHandle, VoiceOrbProps>(function VoiceOrb(
  {
    isTalking = false,
    size = 240,
    colors,
  },
  ref
) {

  const webViewRef =
    useRef<WebView>(null);

  const isReady =
    useRef(false);

  useImperativeHandle(ref, () => ({
    setAudioLevel: (level: number) => {
      if (
        !isReady.current ||
        !webViewRef.current
      ) {
        return;
      }

      webViewRef.current.injectJavaScript(
        `
        window.setAudioLevel &&
        window.setAudioLevel(${level});

        true;
        `
      );
    },
  }));

  // ==========================================
  // TALKING STATE
  // ==========================================

  useEffect(() => {

    if (
      !isReady.current ||
      !webViewRef.current
    ) {
      return;
    }

    webViewRef.current.injectJavaScript(
      `
      window.setTalking &&
      window.setTalking(${isTalking});

      true;
      `
    );

  }, [isTalking]);

  // ==========================================
  // COLORS
  // ==========================================

  useEffect(() => {

    if (
      !isReady.current ||
      !webViewRef.current ||
      !colors
    ) {
      return;
    }

    webViewRef.current.injectJavaScript(
      `
      window.setColors &&
      window.setColors(
        ${JSON.stringify(colors)}
      );

      true;
      `
    );

  }, [colors]);

  // ==========================================
  // WEBVIEW LOADED
  // ==========================================

  const handleLoadEnd = () => {

    isReady.current = true;

    // Sync talking state
    webViewRef.current?.injectJavaScript(
      `
      window.setTalking &&
      window.setTalking(${isTalking});

      true;
      `
    );

    // Sync colors
    if (colors) {

      webViewRef.current?.injectJavaScript(
        `
        window.setColors &&
        window.setColors(
          ${JSON.stringify(colors)}
        );

        true;
        `
      );

    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >

      <WebView
        ref={webViewRef}

        source={{
          html: ORB_HTML,
        }}

        originWhitelist={['*']}

        javaScriptEnabled={true}

        domStorageEnabled={true}

        scrollEnabled={false}

        bounces={false}

        showsHorizontalScrollIndicator={false}

        showsVerticalScrollIndicator={false}

        automaticallyAdjustContentInsets={false}

        onLoadEnd={handleLoadEnd}

        onError={(event) => {

          console.log(
            'VOICE ORB WEBVIEW ERROR:',
            event.nativeEvent
          );

        }}

        onHttpError={(event) => {

          console.log(
            'VOICE ORB HTTP ERROR:',
            event.nativeEvent
          );

        }}

        style={{
          width: size,
          height: size,
          backgroundColor: 'transparent',
        }}

        containerStyle={{
          width: size,
          height: size,
          backgroundColor: 'transparent',
        }}

        androidLayerType="software"
      />

    </View>
  );
});

export default VoiceOrb;

const styles = StyleSheet.create({

  wrapper: {

    alignItems: 'center',

    justifyContent: 'center',

    overflow: 'hidden',

    backgroundColor: 'transparent',
  },

});