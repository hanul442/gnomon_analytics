"""Stand-in for flash-attention's rotary_emb kernel: rotates (x1, x2) by (cos, sin) into (o1, o2)."""


def apply_rotary(x1, x2, cos, sin, o1, o2, conj):
    if conj:
        sin = -sin
    r1 = x1 * cos - x2 * sin
    r2 = x1 * sin + x2 * cos
    o1.copy_(r1)
    o2.copy_(r2)
