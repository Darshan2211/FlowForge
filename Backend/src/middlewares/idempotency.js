import { idempotencyModel } from "../models/idempotency.model.js";

export const idempotencyMiddleware = async (req, res, next) => {
  const key = req.headers["idempotency-key"];
  if (!key)
    return res
      .status(400)
      .json({ error: "Idempotency key header is required" });

  const scopedKey = `${req.method}:${req.baseUrl}${req.route.path}:${key}`;

  try {
    await idempotencyModel.create({ userId: req.user.id, key: scopedKey });
  } catch (error) {
    if (error.code !== 11000) return next(error);

    const existing = await idempotencyModel.findOne({
      userId: req.userId,
      key: scopedKey,
    });
    if (existing?.status === "done") {
      res.set("Idempotent", "true");
      return res.status(existing.responseStatus).json(existing.responseBody);
    }
    return res
      .status(409)
      .json({ error: "Request already in progress, retry" });
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const status = res.statusCode;
    if (status >= 500) {
      IdempotencyKey.deleteOne({ userId: req.userId, key: scopedKey }).catch(
        () => {},
      );
    } else {
      idempotencyModel.updateOne(
        { userId: req.userId, key: scopedKey },
        { status: "done", responseStatus: status, responseBody: body },
      ).catch(() => {});
    }
    return originalJson(body);
  };
  next()
};
