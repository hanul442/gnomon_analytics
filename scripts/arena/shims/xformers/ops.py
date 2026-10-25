"""Stand-in for xformers.ops.SwiGLU with unpacked weights (w1, w2, w3), as YingLong builds it."""
import torch
from torch import nn


class SwiGLU(nn.Module):
    def __init__(self, in_features, hidden_features, out_features=None, bias=True, *, _pack_weights=True):
        super().__init__()
        assert not _pack_weights, 'only the unpacked layout is used'
        out_features = out_features or in_features
        self.w1 = nn.Linear(in_features, hidden_features, bias=bias)
        self.w2 = nn.Linear(in_features, hidden_features, bias=bias)
        self.w3 = nn.Linear(hidden_features, out_features, bias=bias)

    def forward(self, x):
        return self.w3(torch.nn.functional.silu(self.w1(x)) * self.w2(x))
