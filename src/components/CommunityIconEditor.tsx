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
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";

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
  const t = useT();
  const locale = useLocale();
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
        setError(t("图片无法读取，请重新选择", "The image cannot be read. Choose another."));
        setDimensions({ width: 0, height: 0 });
        setLoading(false);
      }
    };
    image.src = source;
    return () => {
      active = false;
    };
  }, [source, t]);

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
      setError(t("请选择 4 MB 以内的 PNG、JPEG 或 WebP 图片", "Choose a PNG, JPEG or WebP image up to 4 MB."));
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
      setError(t("读取图片失败，请重新选择", "Failed to read the image. Choose again."));
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
      setMessage(t("社群图标已保存，卡片和社群页已更新。", "Community icon saved. Cards and the community page are updated."));
      router.refresh();
    } catch {
      setError(t("保存失败，请检查网络后重试。当前裁切已保留。", "Save failed. Check your network and try again; your crop is kept."));
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
        {t("选择游戏图标", "Choose game icon")}
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
        {t(
          "拖动图片调整位置，也可使用下方滑块。裁切框内为最终显示范围。",
          "Drag the image or use the sliders below. The crop frame shows the final display area.",
        )}
      </p>
      <div className={styles.workspace}>
        <div
          className={styles.crop}
          role="img"
          aria-label={t("图标裁切预览", "Icon crop preview")}
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
            <span>{loading ? t("正在读取图片…", "Reading image…") : t("选择图片后开始裁切", "Choose an image to start cropping")}</span>
          )}
          {image && <span className={styles.grid} aria-hidden="true" />}
        </div>
        <div className={styles.controls}>
          <div className={styles.previewRow}>
            <span className={styles.preview} role="img" aria-label={t("缩略图预览", "Thumbnail preview")}>
              {image}
            </span>
            <span>
              <strong>{initial.title}</strong>
              <span className={styles.help}>{t("社群图标预览", "Community icon preview")}</span>
            </span>
          </div>
          <fieldset disabled={busy || loading || !image}>
            <legend>{t("裁切调整", "Crop")}</legend>
            <label>
              {t("放大", "Zoom")}{" "}
              <output>{t(`${crop.zoom.toFixed(2)} 倍`, `${crop.zoom.toFixed(2)}×`)}</output>
              <input
                aria-label={t("放大", "Zoom")}
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
              {t("水平位置", "Horizontal")} <output>{Math.round(crop.x)}%</output>
              <input
                aria-label={t("水平位置", "Horizontal")}
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
              {t("垂直位置", "Vertical")} <output>{Math.round(crop.y)}%</output>
              <input
                aria-label={t("垂直位置", "Vertical")}
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
              {t("重置裁切", "Reset crop")}
            </button>
          </fieldset>
        </div>
      </div>
      <label className={styles.credit}>
        {t("图片来源（选填）", "Image source (optional)")}
        <input
          type="text"
          maxLength={200}
          value={credit}
          disabled={busy}
          placeholder={t("如：游戏官网、社群自制", "e.g. official game site, made by the community")}
          onChange={(e) => {
            setCredit(e.target.value);
            setDirty(true);
            setMessage("");
          }}
        />
      </label>
      {error && (
        <p role="alert" className={styles.error}>
          {localizeAccountMessage(error, locale)}
        </p>
      )}
      <p role="status" className={styles.help}>
        {message || (dirty ? t("调整尚未保存", "Changes not saved yet") : "")}
      </p>
      <button
        type="button"
        className={styles.save}
        onClick={save}
        disabled={busy || loading || !image || !dirty}
      >
        {busy ? t("正在保存…", "Saving…") : t("保存社群图标", "Save community icon")}
      </button>
    </div>
  );
}
