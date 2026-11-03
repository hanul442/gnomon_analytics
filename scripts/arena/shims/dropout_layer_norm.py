"""Stand-in for flash-attention's fused dropout + add + layer norm, inference only (dropout must be 0)."""
import torch


def dropout_add_ln_fwd(x0, residual, gamma, beta, rowscale, colscale, _a, _b, dropout_p, eps, _scale, _rows, _gen, residual_in_fp32, is_rms_norm):
    assert dropout_p == 0.0, 'the stand-in does inference only'
    x = x0 if residual is None else x0 + residual
    if rowscale is not None:
        x = x * rowscale.view(-1, 1)
    if colscale is not None:
        x = x * colscale
    xf = x.float()
    if is_rms_norm:
        z = xf * torch.rsqrt(xf.pow(2).mean(-1, keepdim=True) + eps)
    else:
        z = torch.nn.functional.layer_norm(xf, (xf.shape[-1],), eps=eps)
    z = z.to(x0.dtype) * gamma
    if beta is not None:
        z = z + beta
    return z, x, None, None, None
