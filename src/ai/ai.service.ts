import {
  BadGatewayException,
  Injectable,
  Logger,
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

type GenerateImage5Input = {
  projectContext: Record<string, unknown>;
  style?: string;
  advantages: string[];
  limitations: string[];
};

type RefineImage5Input = {
  projectContext: Record<string, unknown>;
  style?: string;
  feedback: string;
  advantages: string[];
  limitations: string[];
};

type GenerateImage6Input = {
  projectContext: Record<string, unknown>;
  style?: string;
  productNames: string[];
};

type RefineImage6Input = {
  projectContext: Record<string, unknown>;
  style?: string;
  feedback: string;
  productNames: string[];
};

type GenerateImage7Input = {
  projectContext: Record<string, unknown>;
  style?: string;
  direction: string;
  headline: string;
};

type RefineImage7Input = {
  projectContext: Record<string, unknown>;
  style?: string;
  feedback: string;
  direction: string;
  headline: string;
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
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) { }

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

  private toJsonObject(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
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
    const jsonRequestBody = this.toJsonObject(requestBody);
    this.logger.log(
      `AI request -> path=${path}, endpoint=${endpoint}, keys=${Object.keys(jsonRequestBody).join(',')}`,
    );
    let response: Awaited<ReturnType<typeof fetch>>;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json, image/*, application/octet-stream',
          'content-type': 'application/json',
        },
        body: JSON.stringify(jsonRequestBody),
      });
    } catch (error) {
      console.log('🚀 ~ AiService ~ requestImageGeneration ~ error:', error);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `AI network error -> path=${path}, endpoint=${endpoint}, message=${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException('AI image service is unavailable');
    }

    const contentType =
      response.headers.get('content-type')?.toLowerCase() ?? '';
    const imageFileName = `image-${Date.now()}-${randomUUID()}`;
    const jobIdHeader = response.headers.get('x-job-id') ?? undefined;
    const promptHeader =
      response.headers.get('x-generated-prompt') ?? undefined;
    const statusHeader = response.headers.get('x-status') ?? undefined;

    console.log(
      '🚀 ~ AiService ~ requestImageGeneration ~ response:',
      response,
    );
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
      } else {
        const rawError = await response.text().catch(() => '');
        if (rawError) {
          errorMessage = rawError.slice(0, 500);
        }
      }
      this.logger.error(
        `AI response error -> path=${path}, status=${response.status}, contentType=${contentType}, message=${errorMessage}`,
      );
      throw new BadGatewayException(errorMessage);
    }
    this.logger.log(
      `AI response ok -> path=${path}, status=${response.status}, contentType=${contentType}`,
    );

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

    const rawImageUrl = this.pickString(body, [
      'image_url',
      'imageUrl',
      'result_image_url',
      'generated_image_url',
      'output_url',
    ]);
    const imageUrl =
      rawImageUrl && !rawImageUrl.startsWith('data:') ? rawImageUrl : undefined;
    const decodedImageFromUrl =
      rawImageUrl && rawImageUrl.startsWith('data:')
        ? this.decodeBase64Image(rawImageUrl)
        : null;

    const encodedImage = this.pickString(body, [
      'image_base64',
      'image',
      'generated_image_base64',
      'output_image_base64',
    ]);
    const decodedImageFromField = encodedImage
      ? this.decodeBase64Image(encodedImage)
      : null;
    const decodedImage = decodedImageFromField ?? decodedImageFromUrl;

    const prompt = this.pickPrompt(body);
    const refinePrompt = this.pickString(body, ['refine_prompt']);
    const status = this.pickString(body, ['status']);
    const jobId = this.pickString(body, ['job_id', 'jobId']) ?? jobIdHeader;

    if (!imageUrl && !decodedImage) {
      const explicitError = this.pickString(body, [
        'error',
        'detail',
        'message',
      ]);
      if (explicitError) {
        throw new BadGatewayException(explicitError);
      }
      if (jobId || status) {
        this.logger.warn(
          `AI pending -> path=${path}, jobId=${jobId ?? 'n/a'}, status=${status ?? 'n/a'}`,
        );
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

    this.logger.log(
      `AI parsed output -> path=${path}, imageUrl=${Boolean(imageUrl)}, imageBuffer=${Boolean(decodedImage?.buffer)}, jobId=${jobId ?? 'n/a'}`,
    );
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
    this.logger.log(
      `generateImage1 called -> hasProject=${Boolean(input.project)}, hasImageUrl=${Boolean(input.imageUrl)}`,
    );
    const path =
      this.config.get<string>('AI_IMAGE1_GENERATE_PATH') ??
      '/api/step4/generate/main-product';

    return this.requestImageGeneration(path, {
      project: input.project,
      style: input.style,
      imageUrl: input.imageUrl,
    });
  }

  async refineImage1(input: RefineImage1Input): Promise<GenerateImageResult> {
    console.log('🚀 ~ AiService ~ refineImage1 ~ input:', input);
    const path =
      this.config.get<string>('AI_IMAGE1_REFINE_PATH') ??
      '/api/step4/refine/main-product';
    console.log('🚀 ~ AiService ~ refineImage1 ~ input:', input);
    return this.requestImageGeneration(path, {
      project: input.projectContext,
      style: input.style,
      feedback: input.feedback,
      imageUrl: input.imageUrl,
    });
  }

  async generateImage2(
    input: GenerateImage2Input,
  ): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE2_GENERATE_PATH') ??
      '/api/step4/generate/key-facts';
    console.log('🚀 ~ AiService ~ gen2 ~ input:', input);
    return this.requestImageGeneration(path, {
      project: input.project,
      style: input.style,
      keyFacts: input.keyFacts,
      backgroundStyle: input.backgroundStyle,
      logoPosition: input.logoPosition,
      imageUrl: input.imageUrl,
    });
  }

  async refineImage2(input: RefineImage2Input): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE2_REFINE_PATH') ??
      '/api/step4/refine/key-facts';
    console.log('🚀 ~ AiService ~ refineImage2 ~ input:', input);
    return this.requestImageGeneration(path, {
      projectContext: input.projectContext,
      style: input.style,
      feedback: input.feedback,
      keyFacts: input.keyFacts,
      backgroundStyle: input.backgroundStyle,
      logoPosition: input.logoPosition,
      imageUrl: input.imageUrl,
    });
  }

  async generateImage3(
    input: GenerateImage3Input,
  ): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE3_GENERATE_PATH') ??
      '/api/step4/generate/lifestyle';
    console.log('🚀 ~ AiService ~ generateImage3 ~ input:', input);
    return this.requestImageGeneration(path, {
      project: input.project,
      style: input.style,
      scenario: input.scenario,
      refImageUrl: input.refImageUrl,
    });
  }

  async refineImage3(input: RefineImage3Input): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE3_REFINE_PATH') ??
      '/api/step4/refine/lifestyle';
    console.log('🚀 ~ AiService ~ refineImage3 ~ input:', input);
    return this.requestImageGeneration(path, {
      projectContext: input.projectContext,
      style: input.style,
      feedback: input.feedback,
      scenario: input.scenario,
      refImageUrl: input.refImageUrl,
    });
  }

  async generateImage4(
    input: GenerateImage4Input,
  ): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE4_GENERATE_PATH') ??
      '/api/step4/generate/usps';
    console.log('AI generateImage4 input:', input);
    return this.requestImageGeneration(path, {
      project: input.projectContext,
      projectContext: input.projectContext,
      project_context: input.projectContext,
      style: input.style,
      // style_template: input.style,
      usps: input.usps,
    });
  }

  async refineImage4(input: RefineImage4Input): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE4_REFINE_PATH') ??
      '/api/step4/refine/usps';
    console.log('AI refineImage4 input:', input);

    return this.requestImageGeneration(path, {
      // project: input.projectContext,
      projectContext: input.projectContext,
      // project_context: input.projectContext,
      // project_id:
      //   typeof input.projectContext.id === 'string'
      //     ? input.projectContext.id
      //     : undefined,
      style: input.style,
      // style_template: input.style,
      feedback: input.feedback,
      usps: input.usps,
    });
  }

  async generateImage5(
    input: GenerateImage5Input,
  ): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE5_GENERATE_PATH') ??
      '/api/step4/generate/comparison';
    console.log('🚀 ~ AiService ~ generateImage5 ~ input:', input);
    return this.requestImageGeneration(path, {
      style: input.style,
      projectContext: input.projectContext,
      advantages: input.advantages,
      limitations: input.limitations,
    });
  }

  async refineImage5(input: RefineImage5Input): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE5_REFINE_PATH') ??
      '/api/step4/refine/comparison';
    console.log('🚀 ~ AiService ~ refineImage5 ~ input:', input);

    return this.requestImageGeneration(path, {
      style: input.style,
      projectContext: input.projectContext,
      feedback: input.feedback,
      advantages: input.advantages,
      limitations: input.limitations,
    });
  }

  async generateImage6(
    input: GenerateImage6Input,
  ): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE6_GENERATE_PATH') ??
      '/api/step4/generate/cross-selling';
    console.log('🚀 ~ AiService ~ generateImage6 ~ input:', input);
    return this.requestImageGeneration(path, {
      project: input.projectContext,
      projectContext: input.projectContext,
      project_context: input.projectContext,

      style: input.style,
      style_template: input.style,
      productNames: input.productNames,
      product_names: input.productNames,
    });
  }

  async refineImage6(input: RefineImage6Input): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE6_REFINE_PATH') ??
      '/api/step4/refine/cross-selling';
    console.log('🚀 ~ AiService ~ refineImage6 ~ input:', input);

    return this.requestImageGeneration(path, {
      project: input.projectContext,
      projectContext: input.projectContext,
      project_context: input.projectContext,

      style: input.style,
      style_template: input.style,
      feedback: input.feedback,
      productNames: input.productNames,
      product_names: input.productNames,
    });
  }

  async generateImage7(
    input: GenerateImage7Input,
  ): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE7_GENERATE_PATH') ??
      '/api/step4/generate/closing';
    console.log('🚀 ~ AiService ~ generateImage7 ~ input:', input);
    return this.requestImageGeneration(path, {
      project: input.projectContext,
      projectContext: input.projectContext,
      project_context: input.projectContext,

      style: input.style,
      style_template: input.style,
      direction: input.direction,
      headline: input.headline,
    });
  }

  async refineImage7(input: RefineImage7Input): Promise<GenerateImageResult> {
    const path =
      this.config.get<string>('AI_IMAGE7_REFINE_PATH') ??
      '/api/step4/refine/closing';
    console.log('🚀 ~ AiService ~ refineImage7 ~ input:', input);

    return this.requestImageGeneration(path, {
      project: input.projectContext,
      projectContext: input.projectContext,
      project_context: input.projectContext,

      style: input.style,
      style_template: input.style,
      feedback: input.feedback,
      direction: input.direction,
      headline: input.headline,
    });
  }
}
