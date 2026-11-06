import { CreateUploadUrlsSchema } from "@/contracts";
import { requireUser, type Authenticator } from "@/backend/shared/presentation/auth";
import { created, parseJson } from "@/backend/shared/presentation/http";
import type { MediaUploads } from "../application/media.usecases";

export class MediaController {
  constructor(
    private readonly auth: Authenticator,
    private readonly uploads: MediaUploads,
  ) {}

  createUploadUrls = async (request: Request) => {
    const user = await requireUser(request, this.auth);
    return created(await this.uploads.createUploadUrls(user, await parseJson(request, CreateUploadUrlsSchema)));
  };
}
