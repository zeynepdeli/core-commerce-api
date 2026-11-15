"use client";

import {
  useWatch,
  type Control,
  type FieldValues,
  type UseFormSetValue,
} from "react-hook-form";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { mediaSrc } from "@/lib/media-src";

/** Mağazadaki varsayılan kemerli kapı görseline göre ölçülmüş yer (API: VideoBoxDto, bölümün %'si) */
export const DEFAULT_VIDEO_BOX = {
  left: 12,
  top: 28.5,
  width: 27.6,
  height: 67.4,
  curve: 34,
};

type VideoBox = typeof DEFAULT_VIDEO_BOX;

const FIELDS: {
  key: keyof VideoBox;
  label: string;
  min: number;
  max: number;
  hint: string;
}[] = [
  { key: "left", label: "Soldan", min: 0, max: 90, hint: "%" },
  { key: "top", label: "Üstten", min: 0, max: 90, hint: "%" },
  { key: "width", label: "Genişlik", min: 5, max: 100, hint: "%" },
  { key: "height", label: "Yükseklik", min: 5, max: 100, hint: "%" },
  {
    key: "curve",
    label: "Kemer eğrisi",
    min: 0,
    max: 50,
    hint: "% (0 = düz köşe)",
  },
];

/**
 * Kategoriler bölümünde videonun arka plandaki kapıya göre yeri. Arka plan bölüme %100 x %100
 * gerildiği için değerler bölümün yüzdesi: önizleme ile mağaza aynı oranı kullanır.
 * Önizleme tipik bir masaüstü ekran oranında (1440 x 868) çizilir.
 */
export function VideoBoxEditor<T extends FieldValues>({
  control,
  setValue,
  background,
  video,
  mediaBaseUrl,
}: {
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  /** Seçili masaüstü arka planı (boşsa varsayılanın adresi) */
  background: string | null;
  /** Seçili video (boşsa varsayılanın adresi) */
  video: string | null;
  mediaBaseUrl: string;
}) {
  const c = control as unknown as Control<{ videoBox: VideoBox }>;
  const box = useWatch({ control: c, name: "videoBox" }) ?? DEFAULT_VIDEO_BOX;
  const set = setValue as unknown as UseFormSetValue<{ videoBox: VideoBox }>;
  const value = (k: keyof VideoBox) =>
    Number.isFinite(Number(box[k])) ? Number(box[k]) : DEFAULT_VIDEO_BOX[k];

  return (
    <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="relative aspect-1440/868 w-full overflow-hidden rounded-2xl border border-border bg-[#efe3cb]">
        {background && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaSrc(background, mediaBaseUrl)}
            alt=""
            className="absolute inset-0 size-full object-fill"
          />
        )}
        <div
          className="absolute overflow-hidden bg-black/40 ring-2 ring-(--brand-accent)"
          style={{
            left: `${value("left")}%`,
            top: `${value("top")}%`,
            width: `${value("width")}%`,
            height: `${value("height")}%`,
            borderTopLeftRadius: `50% ${value("curve")}%`,
            borderTopRightRadius: `50% ${value("curve")}%`,
          }}
        >
          {video && (
            <video
              key={video}
              src={mediaSrc(video, mediaBaseUrl)}
              muted
              loop
              autoPlay
              playsInline
              className="size-full scale-105 object-cover object-[center_18%]"
            />
          )}
        </div>
        <span className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          Masaüstü önizleme
        </span>
      </div>

      <div className="grid content-start gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="grid gap-1 text-sm font-medium">
            <span className="flex items-center justify-between">
              {f.label}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {value(f.key)} {f.hint}
              </span>
            </span>
            <input
              type="range"
              min={f.min}
              max={f.max}
              step={0.1}
              // Kontrollü: register edilen range alanı ilk yüklemede tarayıcının varsayılanını (aralık ortası) forma yazıyordu
              name={`videoBox.${f.key}`}
              value={value(f.key)}
              onChange={(e) =>
                set(`videoBox.${f.key}`, Number(e.target.value), {
                  shouldDirty: true,
                })
              }
              className="w-full accent-(--brand-accent)"
            />
          </label>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              set("videoBox", DEFAULT_VIDEO_BOX, { shouldDirty: true })
            }
          >
            <RotateCcw className="size-3.5" /> Varsayılan kapıya göre
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Yeni bir arka plan yüklediysen videoyu kapının boşluğuna oturana kadar
          kaydır. Telefonda video, kartların arkasında kendi kemer biçimiyle
          görünür.
        </p>
      </div>
    </div>
  );
}
