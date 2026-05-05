/// <reference types="node" />

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
  type Result,
} from "@zxing/library";
import sharp from "sharp";

export interface ImageInput {
  image_path?: string | undefined;
  image_base64?: string | undefined;
  image_data_uri?: string | undefined;
  image_mime_type?: string | undefined;
}

export interface DecodedBarcode {
  text: string;
  format: string;
  confidence: number;
  rotation_degrees: number;
}

export interface DecodeBarcodeImageResult {
  ok: boolean;
  image: {
    source: "path" | "base64" | "data_uri";
    mime_type?: string;
    width?: number;
    height?: number;
  };
  barcodes: DecodedBarcode[];
  warnings: string[];
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DECODE_DIMENSION = 1600;
const BARCODE_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
];

export async function decodeBarcodeImage(input: ImageInput): Promise<DecodeBarcodeImageResult> {
  const image = await loadImage(input);
  const warnings: string[] = [];

  for (const rotation of [0, 90, 180, 270]) {
    const raster = await rasterize(image.buffer, rotation);
    const decoded = tryDecode(raster.data, raster.width, raster.height, rotation);
    if (decoded !== undefined) {
      return {
        ok: true,
        image: {
          source: image.source,
          ...(image.mime_type === undefined ? {} : { mime_type: image.mime_type }),
          width: raster.width,
          height: raster.height,
        },
        barcodes: [decoded],
        warnings,
      };
    }
  }

  warnings.push("No barcode could be decoded from the image. Ask for a sharper, flatter photo with the full barcode visible.");
  return {
    ok: false,
    image: {
      source: image.source,
      ...(image.mime_type === undefined ? {} : { mime_type: image.mime_type }),
    },
    barcodes: [],
    warnings,
  };
}

async function loadImage(input: ImageInput): Promise<{
  buffer: Buffer;
  source: DecodeBarcodeImageResult["image"]["source"];
  mime_type?: string;
}> {
  const provided = [input.image_path, input.image_base64, input.image_data_uri].filter(
    (value) => value !== undefined && value.trim().length > 0,
  );
  if (provided.length !== 1) {
    throw new Error("Provide exactly one of image_path, image_base64, or image_data_uri.");
  }

  if (input.image_path !== undefined && input.image_path.trim().length > 0) {
    const buffer = await fs.readFile(expandHome(input.image_path.trim()));
    assertImageSize(buffer);
    return {
      buffer,
      source: "path",
      ...(input.image_mime_type === undefined ? {} : { mime_type: input.image_mime_type }),
    };
  }

  if (input.image_data_uri !== undefined && input.image_data_uri.trim().length > 0) {
    const match = input.image_data_uri.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match?.[2]) {
      throw new Error("image_data_uri must be a base64 data URI.");
    }
    const buffer = Buffer.from(match[2], "base64");
    const mime_type = match[1] ?? "application/octet-stream";
    assertImageSize(buffer);
    return {
      buffer,
      source: "data_uri",
      mime_type,
    };
  }

  const buffer = Buffer.from((input.image_base64 ?? "").replace(/\s+/g, ""), "base64");
  assertImageSize(buffer);
  return {
    buffer,
    source: "base64",
    ...(input.image_mime_type === undefined ? {} : { mime_type: input.image_mime_type }),
  };
}

async function rasterize(buffer: Buffer, rotation: number): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  const pipeline = sharp(buffer, { limitInputPixels: 24_000_000 })
    .rotate(rotation)
    .resize({
      width: MAX_DECODE_DIMENSION,
      height: MAX_DECODE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .grayscale()
    .raw();
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  };
}

function tryDecode(
  luminance: Uint8ClampedArray,
  width: number,
  height: number,
  rotation: number,
): DecodedBarcode | undefined {
  const source = new RGBLuminanceSource(luminance, width, height);
  const inverted = source.invert();
  const sources = [source, inverted];

  for (const current of sources) {
    for (const binarizer of [HybridBinarizer, GlobalHistogramBinarizer]) {
      const reader = buildReader();
      try {
        const result = reader.decode(new BinaryBitmap(new binarizer(current)));
        return barcodeFromResult(result, rotation);
      } catch {
        continue;
      } finally {
        reader.reset();
      }
    }
  }

  return undefined;
}

function buildReader(): MultiFormatReader {
  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, BARCODE_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  return reader;
}

function barcodeFromResult(result: Result, rotation: number): DecodedBarcode {
  return {
    text: result.getText(),
    format: BarcodeFormat[result.getBarcodeFormat()],
    confidence: 0.9,
    rotation_degrees: rotation,
  };
}

function assertImageSize(buffer: Buffer): void {
  if (buffer.byteLength === 0) {
    throw new Error("Image input is empty.");
  }

  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`Image input is too large. Maximum supported size is ${MAX_IMAGE_BYTES} bytes.`);
  }
}

function expandHome(path: string): string {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }

  return path;
}
