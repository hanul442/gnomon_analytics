"""Stand-in: YingLong only calls flash_attn on CUDA, which the arena never uses."""


def flash_attn_func(*args, **kwargs):
    raise RuntimeError('flash_attn is not available on CPU')
