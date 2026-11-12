"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  communityIconMaxBytes,
  communityIconTypes,
  defaultIconCrop,
  iconCropRect,
  type IconCrop,
} from "@/lib/community-icon-shared";
import { updateCommunityIcon } from "@/app/(frontend)/community/[slug]/appearance/actions";
import styles from "./CommunityIconEditor.module.css";

type EditorState = {
  title: string;
  source: string | null;
  crop: IconCrop;
  credit: string;
  revision: string;
};
const clamp = (n: number) => Math.max(0, Math.min(100, n));
export function CommunityIconEditor({
  slug,
  initial,
}: {
  slug: string;
  initial: EditorState;
}) {
  const router = useRouter();
  const [source, setSource] = useState(initial.source);
  const [crop, setCrop] = useState(initial.crop);
  const [credit, setCredit] = useState(initial.credit);
  const [revision, setRevision] = useState(initial.revision);
  const [isNew, setIsNew] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    crop: IconCrop;
    width: number;
  } | null>(null);
  useEffect(() => {
    if (!source) return;
    let active = true;
    setLoading(true);
    const image = new Image();
    image.onload = () => {
      if (active) {
        setDimensions({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        setLoading(false);
      }
    };
    image.onerror = () => {
      if (active) {
        setError("图片无法读取，请重新选择");
        setDimensions({ width: 0, height: 0 });
        setLoading(false);
      }
    };
    image.src = source;
    return () => {
      active = false;
    };
  }, [source]);

  function changeCrop(next: IconCrop) {
    setCrop(next);
    setDirty(true);
    setMessage("");
  }
  async function choose(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    if (
      !communityIconTypes.includes(file.type) ||
      file.size > communityIconMaxBytes
    ) {
      setError("请选择 4 MB 以内的 PNG、JPEG 或 WebP 图片");
      return;
    }
    setLoading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setDimensions({ width: 0, height: 0 });
      setSource(data);
      setCrop(defaultIconCrop);
      setIsNew(true);
      setDirty(true);
    } catch {
      setError("读取图片失败，请重新选择");
      setLoading(false);
    }
  }
  const rect = iconCropRect(
    dimensions.width || 1,
    dimensions.height || 1,
    crop,
  );
  const imageStyle: CSSProperties = {
    width: `${(dimensions.width / rect.width) * 100}%`,
    height: `${(dimensions.height / rect.height) * 100}%`,
    left: `${(-rect.left / rect.width) * 100}%`,
    top: `${(-rect.top / rect.height) * 100}%`,
  };
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!source || busy || loading) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      crop,
      width: event.currentTarget.clientWidth,
    };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || busy || loading) return;
    const pixelScale = rect.width / start.width;
    changeCrop({
      ...crop,
      x:
        dimensions.width > rect.width
          ? clamp(
              start.crop.x -
                (((event.clientX - start.x) * pixelScale) /
                  (dimensions.width - rect.width)) *
                  100,
            )
          : 50,
      y:
        dimensions.height > rect.height
          ? clamp(
              start.crop.y -
                (((event.clientY - start.y) * pixelScale) /
                  (dimensions.height - rect.height)) *
                  100,
            )
          : 50,
    });
  }
  async function save() {
    if (!source || !dimensions.width || busy || loading) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await updateCommunityIcon({
        slug,
        source: isNew ? source : undefined,
        crop,
        credit,
        revision,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSource(result.source);
      setRevision(result.revision);
      setIsNew(false);
      setDirty(false);
      setMessage("社群图标已保存，卡片和社群页已更新。");
      router.refresh();
    } catch {
      setError("保存失败，请检查网络后重试。当前裁切已保留。");
    } finally {
      setBusy(false);
    }
  }
  const image =
    source && dimensions.width > 0 ? (
      <img src={source} alt="" draggable={false} style={imageStyle} />
    ) : null;
  return (
    <div className={styles.editor} aria-busy={busy}>
      <label className={styles.fileLabel}>
        选择游戏图标
        <input
          type="file"
          accept={communityIconTypes.join(",")}
          disabled={busy || loading}
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      <p id="icon-help" className={styles.help}>
        拖动图片调整位置，也可使用下方滑块。裁切框内为最终显示范围。
      </p>
      <div className={styles.workspace}>
        <div
          className={styles.crop}
          role="img"
          aria-label="图标裁切预览"
          aria-describedby="icon-help"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
        >
          {image ?? (
            <span>{loading ? "正在读取图片…" : "选择图片后开始裁切"}</span>
          )}
          {image && <span className={styles.grid} aria-hidden="true" />}
        </div>
        <div className={styles.controls}>
          <div className={styles.previewRow}>
            <span className={styles.preview} role="img" aria-label="缩略图预览">
              {image}
            </span>
            <span>
              <strong>{initial.title}</strong>
              <span className={styles.help}>社群图标预览</span>
            </span>
          </div>
          <fieldset disabled={busy || loading || !image}>
            <legend>裁切调整</legend>
            <label>
              放大 <output>{crop.zoom.toFixed(2)} 倍</output>
              <input
                aria-label="放大"
                type="range"
                min="1"
                max="4"
                step="0.01"
                value={crop.zoom}
                onChange={(e) =>
                  changeCrop({ ...crop, zoom: Number(e.target.value) })
                }
              />
            </label>
            <label>
              水平位置 <output>{Math.round(crop.x)}%</output>
              <input
                aria-label="水平位置"
                type="range"
                min="0"
                max="100"
                step="1"
                value={crop.x}
                onChange={(e) =>
                  changeCrop({ ...crop, x: Number(e.target.value) })
                }
              />
            </label>
            <label>
              垂直位置 <output>{Math.round(crop.y)}%</output>
              <input
                aria-label="垂直位置"
                type="range"
                min="0"
                max="100"
                step="1"
                value={crop.y}
                onChange={(e) =>
                  changeCrop({ ...crop, y: Number(e.target.value) })
                }
              />
            </label>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => changeCrop(defaultIconCrop)}
            >
              重置裁切
            </button>
          </fieldset>
        </div>
      </div>
      <label className={styles.credit}>
        图片来源（选填）
        <input
          type="text"
          maxLength={200}
          value={credit}
          disabled={busy}
          placeholder="如：游戏官网、社群自制"
          onChange={(e) => {
            setCredit(e.target.value);
            setDirty(true);
            setMessage("");
          }}
        />
      </label>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <p role="status" className={styles.help}>
        {message || (dirty ? "调整尚未保存" : "")}
      </p>
      <button
        type="button"
        className={styles.save}
        onClick={save}
        disabled={busy || loading || !image || !dirty}
      >
        {busy ? "正在保存…" : "保存社群图标"}
      </button>
    </div>
  );
}
