//go:build windows

package handler

import (
	"os"
	"path/filepath"
)

type diskUsageInfo struct {
	TotalBytes uint64 `json:"total_bytes"`
	UsedBytes  uint64 `json:"used_bytes"`
	FreeBytes  uint64 `json:"free_bytes"`
}

// getDiskUsage on Windows falls back to walking the directory to estimate usage.
// Full disk stats require unsafe Windows API calls which are not needed for this MVP.
func getDiskUsage(path string) (*diskUsageInfo, error) {
	var used uint64
	err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil || info == nil || info.IsDir() {
			return nil
		}
		used += uint64(info.Size())
		return nil
	})
	if err != nil {
		return nil, err
	}
	// Placeholder totals — accurate disk stats require Win32 API
	const oneTB = uint64(1) << 40
	return &diskUsageInfo{
		TotalBytes: oneTB,
		UsedBytes:  used,
		FreeBytes:  oneTB - used,
	}, nil
}
