import { useCallback, useEffect, useState } from 'react';
import { api } from '@gamebuddy/api-client';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onCaptchaIdChange: (captchaId: string) => void;
  disabled?: boolean;
};

export function CaptchaField({
  value,
  onChange,
  onCaptchaIdChange,
  disabled,
}: Props) {
  const [image, setImage] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.getCaptcha()) as {
        captchaId: string;
        image: string;
      };
      onCaptchaIdChange(res.captchaId);
      setImage(res.image);
      onChange('');
    } finally {
      setLoading(false);
    }
    // 仅依赖稳定的 setState；父组件传入的 onChange 可能每次渲染是新引用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="captcha-field">
      <div className="captcha-image-wrap">
        {image ? (
          <img
            src={image}
            alt="图形验证码"
            className="captcha-image"
            draggable={false}
          />
        ) : (
          <div className="captcha-image captcha-image-placeholder">加载中…</div>
        )}
        <button
          type="button"
          className="ghost captcha-refresh"
          onClick={() => void refresh()}
          disabled={disabled || loading}
          title="换一张"
        >
          刷新
        </button>
      </div>
      <input
        type="text"
        className="input-themed captcha-input"
        placeholder="图形验证码（4位数字或小写字母）"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={4}
        autoComplete="off"
        required
      />
    </div>
  );
}
