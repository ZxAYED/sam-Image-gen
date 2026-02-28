import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

type GenerateImage1Input = {
  project: Record<string, unknown>;
  style?: string;
  imageUrl: string;
};

type RefineImage1Input = {
  projectContext: Record<string, unknown>;
  style?: string;
  feedback: string;
  imageUrl: string;
};

type GenerateImage2Input = {
  project: Record<string, unknown>;
  style?: string;
  keyFacts: string[];
  backgroundStyle?: string;
  logoPosition?: string;
  imageUrl?: string;
};

type RefineImage2Input = {
  projectContext: Record<string, unknown>;
  style?: string;
  feedback: string;
  keyFacts: string[];
  backgroundStyle?: string;
  logoPosition?: string;
  imageUrl?: string;
};

type GenerateImage3Input = {
  project: Record<string, unknown>;
  style?: string;
  scenario?: string;
  refImageUrl: string;
};

type RefineImage3Input = {
  projectContext: Record<string, unknown>;
  style?: string;
  feedback: string;
  scenario?: string;
  refImageUrl: string;
};

type GenerateImage4Input = {
  projectContext: Record<string, unknown>;
  style?: string;
  usps: string[];
};

type RefineImage4Input = {
  projectContext: Record<string, unknown>;
  style?: string;
  feedback: string;
  usps: string[];
};

type GenerateImageResult = {
  imageUrl?: string;
  imageBuffer?: Buffer;
  imageMimeType?: string;
  imageFileName: string;
  prompt: string;
  refinePrompt?: string;
  jobId?: string;
  status?: string;
  rawResponse?: Record<string, unknown>;
};

@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  private pickString(
    body: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return undefined;
  }

  private pickPrompt(body: Record<string, unknown>): string {
    const direct = this.pickString(body, [
      'generated_prompt',
      'prompt',
      'analysis_text',
    ]);
    if (direct) {
      return direct;
    }

    const suggested = body.suggested_prompts;
    if (suggested && typeof suggested === 'object') {
      for (const value of Object.values(suggested as Record<string, unknown>)) {
        if (typeof value === 'string' && value.trim().length > 0) {
          return value;
        }
      }
    }

    return 'Prompt not provided by AI service';
  }

  private decodeBase64Image(
    value: string,
  ): { buffer: Buffer; mimeType: string } | null {
    const dataUrlMatch = value.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/,
    );
    if (dataUrlMatch) {
      return {
        buffer: Buffer.from(dataUrlMatch[2], 'base64'),
        mimeType: dataUrlMatch[1].toLowerCase(),
      };
    }

    const trimmed = value.trim();
    const maybeBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed);
    if (!maybeBase64 || trimmed.length < 32) {
      return null;
    }

    try {
      return {
        buffer: Buffer.from(trimmed, 'base64'),
        mimeType: 'image/png',
      };
    } catch {
      return null;
    }
  }

  private async requestImageGeneration(
    path: string,
    requestBody: Record<string, unknown>,
  ): Promise<GenerateImageResult> {
    const aiBaseUrl = this.config.get<string>('AI_API_URL');
    if (!aiBaseUrl) {
      throw new ServiceUnavailableException('AI_API_URL is not configured');
    }

    const endpoint = new URL(path, aiBaseUrl).toString();
    let response: Awaited<ReturnType<typeof fetch>>;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json, image/*, application/octet-stream',
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      console.error('AI image service network error:', error);
      throw new ServiceUnavailableException('AI image service is unavailable');
    }

    const contentType =
      response.headers.get('content-type')?.toLowerCase() ?? '';
    const imageFileName = `image-${Date.now()}-${randomUUID()}`;
    const jobIdHeader = response.headers.get('x-job-id') ?? undefined;
    const promptHeader =
      response.headers.get('x-generated-prompt') ?? undefined;
    const statusHeader = response.headers.get('x-status') ?? undefined;

    if (!response.ok) {
      let errorMessage = 'AI service failed to generate image';
      if (contentType.includes('application/json')) {
        const payload = (await response.json().catch(() => null)) as Record<
          string,
          unknown
        > | null;
        if (payload) {
          const maybeError = this.pickString(payload, [
            'detail',
            'message',
            'error',
          ]);
          if (maybeError) {
            errorMessage = maybeError;
          }
        }
      }
      throw new BadGatewayException(errorMessage);
    }

    if (
      contentType.startsWith('image/') ||
      contentType.includes('octet-stream')
    ) {
      const binary = Buffer.from(await response.arrayBuffer());
      if (binary.length === 0) {
        throw new BadGatewayException('AI returned an empty image response');
      }
      return {
        imageBuffer: binary,
        imageMimeType: contentType.startsWith('image/')
          ? contentType
          : 'image/png',
        imageFileName,
        prompt: promptHeader ?? 'Prompt not provided by AI service',
        jobId: jobIdHeader,
        status: statusHeader ?? 'succeeded',
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException(
        'AI service returned an unreadable response',
      );
    }

    const body =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};

    const explicitError = this.pickString(body, ['error', 'detail', 'message']);
    if (explicitError) {
      throw new BadGatewayException(explicitError);
    }

    const imageUrl = this.pickString(body, [
      'image_url',
      'imageUrl',
      'result_image_url',
      'generated_image_url',
      'output_url',
    ]);

    const encodedImage = this.pickString(body, [
      'image_base64',
      'image',
      'generated_image_base64',
      'output_image_base64',
    ]);
    const decodedImage = encodedImage
      ? this.decodeBase64Image(encodedImage)
      : null;

    const prompt = this.pickPrompt(body);
    const refinePrompt = this.pickString(body, ['refine_prompt']);
    const status = this.pickString(body, ['status']);
    const jobId = this.pickString(body, ['job_id', 'jobId']) ?? jobIdHeader;

    if (!imageUrl && !decodedImage) {
      if (jobId || status) {
        return {
          imageFileName,
          prompt,
          refinePrompt,
          jobId,
          status,
          rawResponse: body,
        };
      }
      throw new BadGatewayException(
        'AI response does not include an image URL or image binary/base64',
      );
    }

    return {
      imageUrl,
      imageBuffer: decodedImage?.buffer,
      imageMimeType: decodedImage?.mimeType,
      imageFileName,
      prompt,
      refinePrompt,
      jobId,
      status,
      rawResponse: body,
    };
  }

  async generateImage1(
    input: GenerateImage1Input,
  ): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE1_GENERATE_PATH') ??
      '/api/step4/generate/main-product';

    return this.requestImageGeneration(path, {
      project_context: input.project,
      style_template: input.style ?? null,
      image_url: input.imageUrl,
    });
  }

  async refineImage1(input: RefineImage1Input): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE1_REFINE_PATH') ??
      '/api/step4/refine/main-product';

    return this.requestImageGeneration(path, {
      project_context: input.projectContext,
      style_template: input.style ?? null,
      feedback: input.feedback,
      image_url: input.imageUrl,
    });
  }

  async generateImage2(
    input: GenerateImage2Input,
  ): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE2_GENERATE_PATH') ??
      '/api/step4/generate/key-facts';

    return this.requestImageGeneration(path, {
      project_context: input.project,
      style_template: input.style ?? null,
      key_facts: input.keyFacts,
      background_style: input.backgroundStyle ?? null,
      logo_position: input.logoPosition ?? null,
      image_url: input.imageUrl ?? null,
    });
  }

  async refineImage2(input: RefineImage2Input): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE2_REFINE_PATH') ??
      '/api/step4/refine/key-facts';

    return this.requestImageGeneration(path, {
      project_context: input.projectContext,
      style_template: input.style ?? null,
      feedback: input.feedback,
      key_facts: input.keyFacts,
      background_style: input.backgroundStyle ?? null,
      logo_position: input.logoPosition ?? null,
      image_url: input.imageUrl ?? null,
    });
  }

  async generateImage3(
    input: GenerateImage3Input,
  ): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE3_GENERATE_PATH') ??
      '/api/step4/generate/lifestyle';

    return this.requestImageGeneration(path, {
      project_context: input.project,
      style_template: input.style ?? null,
      scenario: input.scenario ?? null,
      ref_image_url: input.refImageUrl,
    });
  }

  async refineImage3(input: RefineImage3Input): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE3_REFINE_PATH') ??
      '/api/step4/refine/lifestyle';

    return this.requestImageGeneration(path, {
      project_context: input.projectContext,
      style_template: input.style ?? null,
      feedback: input.feedback,
      scenario: input.scenario ?? null,
      ref_image_url: input.refImageUrl,
    });
  }

  async generateImage4(
    input: GenerateImage4Input,
  ): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE4_GENERATE_PATH') ??
      '/api/step4/generate/usps';

    return this.requestImageGeneration(path, {
      project_context: input.projectContext,
      style_template: input.style ?? null,
      usps: input.usps,
    });
  }

  async refineImage4(input: RefineImage4Input): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE4_REFINE_PATH') ??
      '/api/step4/refine/usps';

    return this.requestImageGeneration(path, {
      project_context: input.projectContext,
      style_template: input.style ?? null,
      feedback: input.feedback,
      usps: input.usps,
    });
  }
}
